import { Router, Response } from 'express';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import http from 'http';
import https from 'https';
import * as fs from 'fs';
import pool, { withTenantClient, adminQuery } from '../db';
import { CustomRequest, authenticateToken } from '../middleware/auth';
import { inspectSslCertificate } from '../services/sslProber';

const router = Router();
const TARGETS_FILE = process.env.PROMETHEUS_TARGETS_FILE || '/etc/prometheus/blackbox_targets.json';
const STARTER_LIMIT = 10; // Raised from 2 to 10 for easier local testing & demo evaluation

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
  const { type, name, url, processes, cloud_provider } = req.body;
  const user = req.user!;

  if (!type || !name || (type === 'url' && !url)) {
    return res.status(400).json({ error: 'Type, Name, and URL (for websites) are required.' });
  }

  if (type !== 'server' && type !== 'url') {
    return res.status(400).json({ error: 'Invalid monitoring type.' });
  }

  const validCloudProviders = ['aws', 'gcp', 'azure', 'digitalocean', 'baremetal', 'other'];
  const provider = validCloudProviders.includes(cloud_provider) ? cloud_provider : 'other';

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
        `INSERT INTO monitored_items (tenant_id, type, name, url, cloud_provider, status, last_checked_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
        [user.tenantId, type, name, type === 'url' ? url : null, provider, type === 'url' ? 'green' : 'red'] // Servers start as red until agent checks in
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

      // Trigger automatic SSL inspection if HTTPS
      if (url.startsWith('https://')) {
        inspectSslCertificate(url).then(async (sslRes) => {
          if (sslRes.success && sslRes.certInfo) {
            try {
              await adminQuery(
                `INSERT INTO ssl_certificates (tenant_id, monitored_item_id, domain, issuer, valid_from, valid_to, days_remaining, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (monitored_item_id) DO UPDATE
                 SET issuer = EXCLUDED.issuer, valid_to = EXCLUDED.valid_to, days_remaining = EXCLUDED.days_remaining, status = EXCLUDED.status, last_checked_at = NOW()`,
                [
                  user.tenantId,
                  result.item.id,
                  sslRes.certInfo.domain,
                  sslRes.certInfo.issuer,
                  sslRes.certInfo.valid_from,
                  sslRes.certInfo.valid_to,
                  sslRes.certInfo.days_remaining,
                  sslRes.certInfo.status
                ]
              );
            } catch (err) {
              console.error('[SSL Registration Error] Failed to cache certificate:', err);
            }
          }
        });
      }
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

// GET /api/monitored-items/:id/ssl (Inspect certificate details)
router.get('/:id/ssl', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  try {
    const cert = await withTenantClient(user.tenantId, async (client) => {
      const dbRes = await client.query(
        'SELECT * FROM ssl_certificates WHERE monitored_item_id = $1',
        [id]
      );
      return dbRes.rows[0];
    });

    if (!cert) {
      return res.status(404).json({ error: 'No SSL certificate data recorded for this monitor.' });
    }

    return res.status(200).json(cert);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/monitored-items/:id/ssl/refresh (Force re-probe certificate)
router.post('/:id/ssl/refresh', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  try {
    const item = await withTenantClient(user.tenantId, async (client) => {
      const dbRes = await client.query('SELECT url FROM monitored_items WHERE id = $1', [id]);
      return dbRes.rows[0];
    });

    if (!item || !item.url) {
      return res.status(400).json({ error: 'Monitored item has no target URL or is not a website.' });
    }

    const sslRes = await inspectSslCertificate(item.url);
    if (!sslRes.success || !sslRes.certInfo) {
      return res.status(400).json({ error: sslRes.error || 'Failed to inspect SSL certificate.' });
    }

    const cert = sslRes.certInfo;
    await withTenantClient(user.tenantId, async (client) => {
      await client.query(
        `INSERT INTO ssl_certificates (tenant_id, monitored_item_id, domain, issuer, valid_from, valid_to, days_remaining, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (monitored_item_id) DO UPDATE
         SET issuer = EXCLUDED.issuer, valid_to = EXCLUDED.valid_to, days_remaining = EXCLUDED.days_remaining, status = EXCLUDED.status, last_checked_at = NOW()`,
        [user.tenantId, id, cert.domain, cert.issuer, cert.valid_from, cert.valid_to, cert.days_remaining, cert.status]
      );
    });

    return res.status(200).json({ message: 'SSL certificate refreshed successfully.', cert });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export { syncBlackboxTargets };
export default router;
