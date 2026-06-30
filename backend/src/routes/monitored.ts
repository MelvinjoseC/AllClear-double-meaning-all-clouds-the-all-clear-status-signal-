import { Router, Response } from 'express';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import http from 'http';
import https from 'https';
import * as fs from 'fs';
import pool, { withTenantClient, adminQuery } from '../db';
import { CustomRequest, authenticateToken } from '../middleware/auth';

const router = Router();
const TARGETS_FILE = process.env.PROMETHEUS_TARGETS_FILE || '/etc/prometheus/blackbox_targets.json';
const STARTER_LIMIT = 2; // Starter tier limit enforced from day 1

// Helper to synchronously probe a URL
function probeUrl(targetUrl: string): Promise<{ ok: boolean; error?: string; statusCode?: number }> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(targetUrl);
      const reqLib = urlObj.protocol === 'https:' ? https : http;
      
      const req = reqLib.request(targetUrl, {
        method: 'GET',
        timeout: 5000,
        headers: { 'User-Agent': 'CloudMon-Prober/1.0' }
      }, (res) => {
        // Site is OK if it returns any code < 500
        const code = res.statusCode || 0;
        resolve({ ok: code < 500, statusCode: code });
      });

      req.on('error', (err) => {
        resolve({ ok: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, error: 'Connection timed out (5s limit exceeded)' });
      });

      req.end();
    } catch (e: any) {
      resolve({ ok: false, error: 'Malformed URL scheme. Must be http:// or https://' });
    }
  });
}

// Helper to write all monitored URLs across all tenants to the Blackbox config file
async function syncBlackboxTargets() {
  try {
    // Admin query bypasses RLS to get all URL targets for Prometheus
    const res = await adminQuery(
      "SELECT id, tenant_id, name, url FROM monitored_items WHERE type = 'url'"
    );

    const targets = res.rows.map(item => ({
      targets: [item.url],
      labels: {
        tenant_id: item.tenant_id,
        monitored_item_id: item.id,
        name: item.name
      }
    }));

    fs.writeFileSync(TARGETS_FILE, JSON.stringify(targets, null, 2));
    console.log(`[Prometheus Config] Synchronized ${targets.length} blackbox URL targets.`);
  } catch (err) {
    console.error('[Prometheus Config Error] Failed to write blackbox targets:', err);
  }
}

// POST /api/monitored-items (Register a server or URL)
router.post('/', authenticateToken, async (req: CustomRequest, res: Response) => {
  const { type, name, url, processes } = req.body;
  const user = req.user!;

  if (!type || !name || (type === 'url' && !url)) {
    return res.status(400).json({ error: 'Type, Name, and URL (for websites) are required.' });
  }

  if (type !== 'server' && type !== 'url') {
    return res.status(400).json({ error: 'Invalid monitoring type.' });
  }

  // 1. Enforce Starter Tier Limits
  try {
    const limitCheck = await withTenantClient(user.tenantId, async (client) => {
      const items = await client.query('SELECT COUNT(*) FROM monitored_items');
      return parseInt(items.rows[0].count);
    });

    if (limitCheck >= STARTER_LIMIT) {
      return res.status(403).json({
        error: `Starter tier limit reached. You can monitor a maximum of ${STARTER_LIMIT} items. Please upgrade for more.`
      });
    }
  } catch (err) {
    console.error('Limit check failed:', err);
    return res.status(500).json({ error: 'Failed to evaluate account limits.' });
  }

  // 2. Synchronous validation for Website URLs
  if (type === 'url') {
    const probe = await probeUrl(url);
    if (!probe.ok) {
      return res.status(400).json({
        error: `Could not reach website URL during registration: ${probe.error || `HTTP Status ${probe.statusCode}`}`
      });
    }
  }

  // 3. Insert and configure item
  try {
    const result = await withTenantClient(user.tenantId, async (client) => {
      // Create monitored item
      const itemRes = await client.query(
        `INSERT INTO monitored_items (tenant_id, type, name, url, status, last_checked_at)
         VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
        [user.tenantId, type, name, type === 'url' ? url : null, type === 'url' ? 'green' : 'red'] // Servers start as red until agent checks in
      );
      const item = itemRes.rows[0];

      if (type === 'server') {
        // Generate cryptographic token
        const rawToken = 'agent_' + crypto.randomBytes(24).toString('hex');
        const tokenHash = await bcrypt.hash(rawToken, 10);

        // Store hashed token
        await client.query(
          `INSERT INTO agent_tokens (tenant_id, monitored_item_id, token_hash)
           VALUES ($1, $2, $3)`,
          [user.tenantId, item.id, tokenHash]
        );

        return { item, rawToken };
      }

      return { item };
    });

    // If it's a URL, update blackbox target definitions
    if (type === 'url') {
      await syncBlackboxTargets();
    }

    if (type === 'server') {
      // Build curl installation command
      const installCommand = `curl -sSL https://localhost/api/agent/install.sh?token=${result.rawToken}&server_id=${result.item.id} | sudo bash`;
      return res.status(201).json({
        message: 'Server registered successfully.',
        item: result.item,
        token: result.rawToken, // Sent ONLY once
        installCommand
      });
    } else {
      return res.status(201).json({
        message: 'Website URL registered successfully.',
        item: result.item
      });
    }
  } catch (err) {
    console.error('Failed to create monitored item:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/monitored-items (List items for current tenant)
router.get('/', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  try {
    const items = await withTenantClient(user.tenantId, async (client) => {
      const res = await client.query('SELECT * FROM monitored_items ORDER BY created_at DESC');
      return res.rows;
    });
    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/monitored-items/:id/status (Heartbeat lookup for onboarding polling)
router.get('/:id/status', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  try {
    const item = await withTenantClient(user.tenantId, async (client) => {
      const res = await client.query(
        'SELECT id, name, type, status, last_checked_at FROM monitored_items WHERE id = $1',
        [id]
      );
      return res.rows[0];
    });

    if (!item) {
      return res.status(404).json({ error: 'Monitored item not found.' });
    }

    return res.status(200).json(item);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/monitored-items/:id (Remove item)
router.delete('/:id', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  try {
    const deleted = await withTenantClient(user.tenantId, async (client) => {
      const res = await client.query('DELETE FROM monitored_items WHERE id = $1 RETURNING *', [id]);
      return res.rows[0];
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Item not found or unauthorized.' });
    }

    if (deleted.type === 'url') {
      await syncBlackboxTargets();
    }

    return res.status(200).json({ message: 'Monitored item deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export { syncBlackboxTargets };
export default router;
