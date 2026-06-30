import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import pool, { adminQuery, withTenantClient } from '../db';
import { CustomRequest, authenticateToken } from '../middleware/auth';

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
  processes: Record<string, number>;
  last_seen: number;
}

export const metricsCache: Record<
  string,
  { tenantId: string; name: string; metrics: AgentMetrics }
> = {};

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
        processes: metrics.processes || {},
        last_seen: Math.floor(Date.now() / 1000)
      }
    };

    return res.status(200).json({ status: 'success', message: 'Metrics processed.' });
  } catch (err) {
    console.error('Agent report failed:', err);
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

export default router;
