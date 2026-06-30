import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pool, { initDb, adminQuery } from './db';
import authRoutes from './routes/auth';
import monitoredRoutes, { syncBlackboxTargets } from './routes/monitored';
import agentRoutes, { metricsCache } from './routes/agent';
import alertRoutes from './routes/alerts';
import { CustomRequest } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 5000;

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

// Start Server & Init database schema
app.listen(PORT, async () => {
  console.log(`[CloudMon Backend] Server running on port ${PORT}`);
  await initDb();
  await syncBlackboxTargets();
});
