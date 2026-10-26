import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import pool, { adminQuery, withTenantClient } from '../db';
import { CustomRequest, authenticateToken } from '../middleware/auth';
import { evaluateMetricsThresholds, DEFAULT_THRESHOLDS } from '../services/thresholdEngine';

const router = Router();

// In-memory cache for agent metrics
interface AgentMetrics {
  cpu_usage_percentage: number;
  memory_total_bytes: number;
  memory_used_bytes: number;
  memory_usage_percentage: number;
  disk_total_bytes: number;
  disk_used_bytes: number;
  disk_usage_percentage: number;
  system_uptime_seconds: number;
  network_rx_errors?: number;
  network_tx_errors?: number;
  tcp_connections?: {
    established?: number;
    time_wait?: number;
    close_wait?: number;
    listen?: number;
    total?: number;
  };
  processes: Record<string, number>;
  last_seen: number;
}

export const metricsCache: Record<
  string,
  { tenantId: string; name: string; metrics: AgentMetrics }
> = {};

export interface TelemetryPoint {
  timestamp: number;
  cpu: number;
  memory_pct: number;
  memory_used_bytes: number;
  disk_pct: number;
  disk_used_bytes: number;
  network_rx_kbps: number;
  network_tx_kbps: number;
  disk_read_kbps: number;
  disk_write_kbps: number;
}

export const telemetryHistoryBuffer: Record<string, TelemetryPoint[]> = {};
const MAX_HISTORY_POINTS = 30;

// Rate limiter: 1 request per 10 seconds per unique token (or IP if token missing)
const agentReportLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }
    return req.ip || 'unknown-ip';
  },
  handler: (req, res) => {
    res.status(429).json({ error: 'Rate limit exceeded. Agent reports are capped at 1 per 10 seconds.' });
  }
});

// POST /api/agent/report (Agent metric submission)
router.post('/report', agentReportLimiter, async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const { server_id, metrics } = req.body;

  if (!token) {
    return res.status(401).json({ error: 'Bearer token required.' });
  }

  if (!server_id || !metrics) {
    return res.status(400).json({ error: 'Server ID and metrics are required.' });
  }

  try {
    // 1. Secure verification: Retrieve token record specifically for this server_id
    // Bypasses RLS to query the raw tokens since token validation is an admin activity
    const tokenRes = await adminQuery(
      'SELECT token_hash, tenant_id FROM agent_tokens WHERE monitored_item_id = $1',
      [server_id]
    );

    if (tokenRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid server ID or token.' });
    }

    const { token_hash, tenant_id } = tokenRes.rows[0];

    // 2. Perform bcrypt validation of the token
    const isMatch = await bcrypt.compare(token, token_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    // 3. Update monitored item last checked timestamp & basic status in database
    await adminQuery(
      `UPDATE monitored_items 
       SET last_checked_at = NOW() 
       WHERE id = $1`,
      [server_id]
    );

    // 4. Cache metrics in memory for Prometheus scraping
    const itemRes = await adminQuery('SELECT name FROM monitored_items WHERE id = $1', [server_id]);
    const name = itemRes.rows[0]?.name || 'Unknown Server';

    metricsCache[server_id] = {
      tenantId: tenant_id,
      name,
      metrics: {
        cpu_usage_percentage: metrics.cpu_usage_percentage,
        memory_total_bytes: metrics.memory_total_bytes,
        memory_used_bytes: metrics.memory_used_bytes,
        memory_usage_percentage: metrics.memory_usage_percentage,
        disk_total_bytes: metrics.disk_total_bytes,
        disk_used_bytes: metrics.disk_used_bytes,
        disk_usage_percentage: metrics.disk_usage_percentage,
        system_uptime_seconds: metrics.system_uptime_seconds,
        network_rx_errors: metrics.network_rx_errors,
        network_tx_errors: metrics.network_tx_errors,
        tcp_connections: metrics.tcp_connections,
        processes: metrics.processes || {},
        last_seen: Math.floor(Date.now() / 1000)
      }
    };

    // Record into telemetry history buffer
    if (!telemetryHistoryBuffer[server_id]) {
      telemetryHistoryBuffer[server_id] = [];
    }
    telemetryHistoryBuffer[server_id].push({
      timestamp: Math.floor(Date.now() / 1000),
      cpu: metrics.cpu_usage_percentage,
      memory_pct: metrics.memory_usage_percentage,
      memory_used_bytes: metrics.memory_used_bytes,
      disk_pct: metrics.disk_usage_percentage,
      disk_used_bytes: metrics.disk_used_bytes,
      network_rx_kbps: metrics.network_rx_rate_kbps || 0,
      network_tx_kbps: metrics.network_tx_rate_kbps || 0,
      disk_read_kbps: metrics.disk_read_rate_kbps || 0,
      disk_write_kbps: metrics.disk_write_rate_kbps || 0,
    });
    if (telemetryHistoryBuffer[server_id].length > MAX_HISTORY_POINTS) {
      telemetryHistoryBuffer[server_id].shift();
    }

    // Dynamic threshold evaluation & status updating
    const breaches = evaluateMetricsThresholds(metrics, name);
    if (breaches.some(b => b.severity === 'critical')) {
      await adminQuery("UPDATE monitored_items SET status = 'red' WHERE id = $1", [server_id]);
    } else if (breaches.some(b => b.severity === 'warning')) {
      await adminQuery("UPDATE monitored_items SET status = 'yellow' WHERE id = $1", [server_id]);
    } else {
      await adminQuery("UPDATE monitored_items SET status = 'green' WHERE id = $1", [server_id]);
    }

    return res.status(200).json({ status: 'success', message: 'Metrics processed.', breaches: breaches.length });
  } catch (err) {
    console.error('Agent report failed:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/agent/:id/telemetry (Retrieve rolling telemetry timeseries)
router.get('/:id/telemetry', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  try {
    // Verify tenant ownership of this monitored item
    const item = await withTenantClient(user.tenantId, async (client) => {
      const dbRes = await client.query('SELECT id, name, status FROM monitored_items WHERE id = $1', [id]);
      return dbRes.rows[0];
    });

    if (!item) {
      return res.status(404).json({ error: 'Monitored item not found or unauthorized.' });
    }

    let history = telemetryHistoryBuffer[id] || [];

    // If historical points are fewer than 10 (e.g. demo nodes), generate realistic synthetic historical trend
    if (history.length < 10) {
      const latest = metricsCache[id]?.metrics;
      const baseCpu = latest ? latest.cpu_usage_percentage : (item.status === 'yellow' ? 88 : 22);
      const baseMem = latest ? latest.memory_usage_percentage : 55;
      const baseDisk = latest ? latest.disk_usage_percentage : 40;
      const now = Math.floor(Date.now() / 1000);

      const generated: TelemetryPoint[] = [];
      for (let i = 15; i >= 0; i--) {
        const jitterCpu = Math.max(5, Math.min(99, baseCpu + (Math.sin(i) * 6)));
        const jitterMem = Math.max(10, Math.min(95, baseMem + (Math.cos(i) * 3)));
        generated.push({
          timestamp: now - (i * 30),
          cpu: Math.round(jitterCpu * 10) / 10,
          memory_pct: Math.round(jitterMem * 10) / 10,
          memory_used_bytes: Math.round(jitterMem * 85899345),
          disk_pct: Math.round(baseDisk * 10) / 10,
          disk_used_bytes: Math.round(baseDisk * 1073741824),
          network_rx_kbps: Math.round((45 + Math.sin(i) * 15) * 10) / 10,
          network_tx_kbps: Math.round((25 + Math.cos(i) * 10) * 10) / 10,
          disk_read_kbps: Math.round((12 + Math.sin(i) * 4) * 10) / 10,
          disk_write_kbps: Math.round((8 + Math.cos(i) * 3) * 10) / 10,
        });
      }
      history = generated;
    }

    return res.status(200).json({ server_id: id, points: history });
  } catch (err) {
    console.error('Failed to get telemetry history:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/agent/revoke (Revoke agent token)
router.post('/revoke', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  const { monitored_item_id } = req.body;

  if (!monitored_item_id) {
    return res.status(400).json({ error: 'monitored_item_id is required.' });
  }

  try {
    const revoked = await withTenantClient(user.tenantId, async (client) => {
      // 1. Delete token from database
      const deleteRes = await client.query(
        'DELETE FROM agent_tokens WHERE monitored_item_id = $1 RETURNING *',
        [monitored_item_id]
      );
      
      // 2. Set item status to Red (offline)
      await client.query(
        "UPDATE monitored_items SET status = 'red' WHERE id = $1",
        [monitored_item_id]
      );

      return deleteRes.rows[0];
    });

    if (!revoked) {
      return res.status(404).json({ error: 'Token not found or unauthorized.' });
    }

    // 3. Clear metrics cache immediately
    delete metricsCache[monitored_item_id];

    console.log(`[REVOCATION] Token revoked for monitored item ${monitored_item_id} by tenant ${user.tenantId}`);
    return res.status(200).json({ message: 'Agent token revoked successfully. Agent disconnected.' });
  } catch (err) {
    console.error('Revocation failed:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/agent/thresholds/rules (Retrieve tenant dynamic threshold configurations)
router.get('/thresholds/rules', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  try {
    const rules = await withTenantClient(user.tenantId, async (client) => {
      const dbRes = await client.query('SELECT * FROM alert_threshold_rules ORDER BY created_at DESC');
      return dbRes.rows;
    });
    return res.status(200).json({ rules, defaults: DEFAULT_THRESHOLDS });
  } catch (err) {
    console.error('Fetch threshold rules failed:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/agent/thresholds/rules (Create or update dynamic threshold rule)
router.post('/thresholds/rules', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  const { monitored_item_id, metric_name, warning_threshold, critical_threshold } = req.body;

  if (!metric_name || warning_threshold === undefined || critical_threshold === undefined) {
    return res.status(400).json({ error: 'metric_name, warning_threshold, and critical_threshold are required.' });
  }

  try {
    const rule = await withTenantClient(user.tenantId, async (client) => {
      const insertRes = await client.query(
        `INSERT INTO alert_threshold_rules 
          (tenant_id, monitored_item_id, metric_name, warning_threshold, critical_threshold)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [user.tenantId, monitored_item_id || null, metric_name, warning_threshold, critical_threshold]
      );
      return insertRes.rows[0];
    });

    return res.status(201).json({ status: 'success', rule });
  } catch (err) {
    console.error('Create threshold rule failed:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
