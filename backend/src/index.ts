import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import * as bcrypt from 'bcryptjs';
import pool, { initDb, adminQuery } from './db';
import authRoutes from './routes/auth';
import monitoredRoutes, { syncBlackboxTargets } from './routes/monitored';
import agentRoutes, { metricsCache } from './routes/agent';
import alertRoutes from './routes/alerts';
import { CustomRequest } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable trusting proxy headers for rate limiting behind Nginx
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());

// ==============================================================================
// RATE LIMITERS
// ==============================================================================

// 1. Auth Endpoint Rate Limiting (5 requests per minute per IP)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many authentication attempts. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Global Public API Limiter (60 requests per minute per IP/Session)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply Limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', globalLimiter); // Applies to /api/monitored-items, /api/alerts/history etc.

// ==============================================================================
// PUBLIC & INTERNAL ENDPOINTS
// ==============================================================================

// 1. Dead-man's switch / Platform health checker (DB connection cache mitigation)
let lastHealthCheck = 0;
let cachedHealthResult = true;

app.get('/health', async (req, res) => {
  const now = Date.now();
  if (now - lastHealthCheck < 2000) {
    // 2-second caching window: return cache instantly without hitting database
    if (cachedHealthResult) {
      return res.status(200).json({ status: 'ok', cached: true });
    } else {
      return res.status(500).json({ status: 'error', cached: true });
    }
  }

  try {
    // Probe database connection
    await adminQuery('SELECT 1');
    cachedHealthResult = true;
    lastHealthCheck = now;
    return res.status(200).json({ status: 'ok', cached: false });
  } catch (err) {
    console.error('[Health Check Error] Database query failed:', err);
    cachedHealthResult = false;
    lastHealthCheck = now;
    return res.status(500).json({ status: 'error', cached: false });
  }
});

// 2. Internal Metrics Exporter for Prometheus (Scraped only container-to-container)
app.get('/internal/metrics', (req, res) => {
  const lines: string[] = [];
  const now = Math.floor(Date.now() / 1000);

  // CPU
  lines.push('# HELP cloudmon_cpu_usage_percentage CPU usage percentage');
  lines.push('# TYPE cloudmon_cpu_usage_percentage gauge');
  // Memory
  lines.push('# HELP cloudmon_memory_usage_percentage Memory usage percentage');
  lines.push('# TYPE cloudmon_memory_usage_percentage gauge');
  lines.push('# HELP cloudmon_memory_total_bytes Memory total size in bytes');
  lines.push('# TYPE cloudmon_memory_total_bytes gauge');
  // Disk
  lines.push('# HELP cloudmon_disk_usage_percentage Disk usage percentage');
  lines.push('# TYPE cloudmon_disk_usage_percentage gauge');
  lines.push('# HELP cloudmon_disk_total_bytes Disk total size in bytes');
  lines.push('# TYPE cloudmon_disk_total_bytes gauge');
  // System Uptime
  lines.push('# HELP cloudmon_system_uptime_seconds System uptime in seconds');
  lines.push('# TYPE cloudmon_system_uptime_seconds gauge');
  // Last Seen
  lines.push('# HELP cloudmon_agent_last_seen_timestamp_seconds Agent last seen epoch timestamp');
  lines.push('# TYPE cloudmon_agent_last_seen_timestamp_seconds gauge');
  // Process Uptime
  lines.push('# HELP cloudmon_process_uptime_seconds Uptime of configured service processes in seconds');
  lines.push('# TYPE cloudmon_process_uptime_seconds gauge');

  for (const [serverId, entry] of Object.entries(metricsCache)) {
    // If agent has been silent for > 15 minutes, filter it out from active scrapes
    if (now - entry.metrics.last_seen > 900) {
      continue;
    }

    const labels = `tenant_id="${entry.tenantId}",monitored_item_id="${serverId}",hostname="${entry.name}"`;

    lines.push(`cloudmon_cpu_usage_percentage{${labels}} ${entry.metrics.cpu_usage_percentage}`);
    lines.push(`cloudmon_memory_usage_percentage{${labels}} ${entry.metrics.memory_usage_percentage}`);
    lines.push(`cloudmon_memory_total_bytes{${labels}} ${entry.metrics.memory_total_bytes}`);
    lines.push(`cloudmon_disk_usage_percentage{${labels}} ${entry.metrics.disk_usage_percentage}`);
    lines.push(`cloudmon_disk_total_bytes{${labels}} ${entry.metrics.disk_total_bytes}`);
    lines.push(`cloudmon_system_uptime_seconds{${labels}} ${entry.metrics.system_uptime_seconds}`);
    lines.push(`cloudmon_agent_last_seen_timestamp_seconds{${labels}} ${entry.metrics.last_seen}`);

    for (const [procName, uptime] of Object.entries(entry.metrics.processes)) {
      lines.push(`cloudmon_process_uptime_seconds{${labels},process_name="${procName}"} ${uptime}`);
    }
  }

  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.status(200).send(lines.join('\n') + '\n');
});

// Bind routers
app.use('/api/auth', authRoutes);
app.use('/api/monitored-items', monitoredRoutes);
app.use('/api/agent', agentRoutes);
app.use('/internal/alerts', alertRoutes); // Mounted as internal-only

// ==============================================================================
// DEMO SEEDING & IN-MEMORY METRICS REPLICATOR
// ==============================================================================

async function seedDemoData() {
  try {
    // Check if demo data is already present
    const check = await adminQuery(
      "SELECT 1 FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001'"
    );
    if (check.rows.length > 0) {
      console.log('[Demo Seed] Demo database records already exist.');
      initDemoCache();
      return;
    }

    console.log('[Demo Seed] Seeding high-fidelity multi-cloud demo assets...');

    // 1. Tenant Creation (Acme Retail Corp)
    await adminQuery(
      "INSERT INTO tenants (id, name, whatsapp_number) VALUES ('00000000-0000-0000-0000-000000000001', 'Acme Retail Corp', '+14155238886')"
    );

    // 2. Demo User Creation
    const passHash = await bcrypt.hash('password123', 10);
    await adminQuery(
      `INSERT INTO users (id, tenant_id, email, password_hash)
       VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'demo@cloudmon.io', $1)`,
      [passHash]
    );

    // 3. Monitored Nodes (AWS Instance + Azure VM + 2 Web URLs)
    await adminQuery(
      `INSERT INTO monitored_items (id, tenant_id, type, name, url, status, last_checked_at, uptime_percentage)
       VALUES 
       ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'server', 'aws-ec2-prod-web', NULL, 'green', NOW(), 99.98),
       ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'server', 'azure-vm-db-replica', NULL, 'yellow', NOW(), 99.23),
       ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'url', 'shared-hosting-website', 'http://httpbin.org/status/200', 'green', NOW(), 100.00),
       ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'url', 'marketing-blog', 'http://httpbin.org/status/500', 'red', NOW(), 98.45)`
    );

    // 4. Secure Hashed Tokens for agent authentication simulation
    const tokenHash = await bcrypt.hash('agent_demotoken_change_me', 10);
    await adminQuery(
      `INSERT INTO agent_tokens (tenant_id, monitored_item_id, token_hash)
       VALUES 
       ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', $1),
       ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', $1)`,
      [tokenHash]
    );

    // 5. Historical alert logs
    await adminQuery(
      `INSERT INTO alert_history (tenant_id, monitored_item_id, alert_name, severity, status, message, suggested_action, starts_at, ends_at)
       VALUES
       ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'HostHighCpu', 'critical', 'firing', 
        '🚨 Your server [azure-vm-db-replica] is working very hard right now (CPU at 94.20%) and may slow down for visitors.', 
        'Consider upgrading server resources or checking for runaway processes using top/htop.', NOW() - INTERVAL '10 minutes', NULL),
       
       ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'SiteDown', 'critical', 'firing', 
        '🚨 Your website [marketing-blog] is currently OFFLINE.', 
        'Check your hosting provider''s status page, verify DNS settings, or restart your web server.', NOW() - INTERVAL '5 minutes', NULL),
       
       ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'SiteDown', 'critical', 'resolved', 
        '✅ [shared-hosting-website] is back to normal as of ' || (NOW() - INTERVAL '1 hour'), 
        'No action required.', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour')`
    );

    console.log('[Demo Seed] Database tables successfully populated.');
    initDemoCache();
  } catch (err) {
    console.error('[Demo Seed Error] Failed to write demo mock data:', err);
  }
}

function initDemoCache() {
  console.log('[Demo Cache] Initializing periodic demo telemetry injection...');

  const refreshCache = () => {
    const nowEpoch = Math.floor(Date.now() / 1000);

    // AWS EC2 metrics
    metricsCache['00000000-0000-0000-0000-000000000002'] = {
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: 'aws-ec2-prod-web',
      metrics: {
        cpu_usage_percentage: 14.50,
        memory_total_bytes: 8589934592,
        memory_used_bytes: 3881478144,
        memory_usage_percentage: 45.19,
        disk_total_bytes: 107374182400,
        disk_used_bytes: 40909563494,
        disk_usage_percentage: 38.10,
        system_uptime_seconds: 1036800.0,
        processes: {
          nginx: 1036800.0,
          postgres: 1036800.0
        },
        last_seen: nowEpoch
      }
    };

    // Azure SQL Replica VM metrics
    metricsCache['00000000-0000-0000-0000-000000000003'] = {
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: 'azure-vm-db-replica',
      metrics: {
        cpu_usage_percentage: 94.20, // Firing alert
        memory_total_bytes: 17179869184,
        memory_used_bytes: 14173167616,
        memory_usage_percentage: 82.50,
        disk_total_bytes: 214748364800,
        disk_used_bytes: 138083196928,
        disk_usage_percentage: 64.30,
        system_uptime_seconds: 259200.0,
        processes: {
          mysql: 259200.0
        },
        last_seen: nowEpoch
      }
    };
  };

  refreshCache();
  // Keep metrics fresh inside Prometheus scrapes by updating timestamp
  setInterval(refreshCache, 10000);
}

// Start Server & Init database schema
app.listen(PORT, async () => {
  console.log(`[CloudMon Backend] Server running on port ${PORT}`);
  await initDb();
  await syncBlackboxTargets();
  await seedDemoData(); // Auto-seed mock data on boot
});
