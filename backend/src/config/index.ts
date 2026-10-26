import * as dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  database: {
    url: string;
    maxConnections: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    bcryptRounds: number;
  };
  monitoring: {
    blackboxTargetsFile: string;
    healthCacheTtlMs: number;
    agentHeartbeatTimeoutSec: number;
    historyRetentionPoints: number;
  };
}

function parseEnvNumber(val: string | undefined, defaultValue: number): number {
  if (!val) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
const defaultDevSecret = 'cloudmon-enterprise-jwt-super-secret-key-change-in-production';
const jwtSecret = process.env.JWT_SECRET || defaultDevSecret;

// Security check in production
if (nodeEnv === 'production') {
  if (jwtSecret === defaultDevSecret || jwtSecret.length < 32) {
    console.warn(
      '[SECURITY WARNING] Production environment detected with insecure or default JWT_SECRET! Please specify a 256-bit secret.'
    );
  }
}

export const config: AppConfig = {
  env: nodeEnv,
  port: parseEnvNumber(process.env.PORT, 5000),
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cloudmon',
    maxConnections: parseEnvNumber(process.env.DB_MAX_CONNECTIONS, 20),
    idleTimeoutMs: parseEnvNumber(process.env.DB_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMs: parseEnvNumber(process.env.DB_CONN_TIMEOUT_MS, 5000),
  },
  auth: {
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    bcryptRounds: 10,
  },
  monitoring: {
    blackboxTargetsFile: process.env.PROMETHEUS_TARGETS_FILE || '/etc/prometheus/blackbox_targets.json',
    healthCacheTtlMs: parseEnvNumber(process.env.HEALTH_CACHE_TTL_MS, 2000),
    agentHeartbeatTimeoutSec: parseEnvNumber(process.env.AGENT_TIMEOUT_SEC, 900),
    historyRetentionPoints: parseEnvNumber(process.env.HISTORY_RETENTION_POINTS, 30),
  },
};

export default config;
