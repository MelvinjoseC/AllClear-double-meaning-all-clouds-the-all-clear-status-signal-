import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cloudmon',
  user: process.env.DB_USER || 'cloudmon_user',
  password: process.env.DB_PASS || 'cloudmon_pass_change_me',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function initDb() {
  const client = await pool.connect();
  try {
    let schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.join(__dirname, '../../src/db/schema.sql');
    }
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      await client.query(schemaSql);
      console.log('Database initialized successfully with schema and RLS policies.');
    } else {
      console.warn('schema.sql file not found at:', schemaPath);
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

/**
 * Execute a query without setting RLS context (e.g. registration, internal systems, etc.)
 */
export async function adminQuery(sql: string, params: any[] = []) {
  return pool.query(sql, params);
}

/**
 * Execute db operations inside a transaction pre-configured with RLS tenant context.
 */
export async function withTenantClient<T>(
  tenantId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Set the tenant ID session variable
    await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant', tenantId]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
