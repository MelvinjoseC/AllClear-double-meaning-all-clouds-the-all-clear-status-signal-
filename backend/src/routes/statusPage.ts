import { Router, Request, Response } from 'express';
import { adminQuery } from '../db';

const router = Router();

// GET /api/public/status/:tenantId (Public Status Page Data)
router.get('/status/:tenantId', async (req: Request, res: Response) => {
  const { tenantId } = req.params;

  try {
    // 1. Fetch Tenant Public Profile
    const tenantRes = await adminQuery('SELECT id, name FROM tenants WHERE id = $1', [tenantId]);
    if (tenantRes.rows.length === 0) {
      return res.status(404).json({ error: 'Status page not found for tenant.' });
    }
    const tenant = tenantRes.rows[0];

    // 2. Fetch Public Items (Sanitized: omit sensitive internal tokens/urls)
    const itemsRes = await adminQuery(
      `SELECT name, type, cloud_provider, status, uptime_percentage, last_checked_at
       FROM monitored_items
       WHERE tenant_id = $1
       ORDER BY name ASC`,
      [tenantId]
    );

    const items = itemsRes.rows;

    // 3. Compute Overall System Status
    let overallState: 'operational' | 'degraded' | 'outage' = 'operational';
    let statusLabel = 'All Systems Operational';

    const hasRed = items.some((i) => i.status === 'red');
    const hasYellow = items.some((i) => i.status === 'yellow');

    if (hasRed) {
      overallState = 'outage';
      statusLabel = 'System Outage Detected';
    } else if (hasYellow) {
      overallState = 'degraded';
      statusLabel = 'Degraded System Performance';
    }

    // 4. Fetch Recent Incidents (Last 7 days)
    const incidentsRes = await adminQuery(
      `SELECT alert_name, severity, status, message, starts_at, ends_at
       FROM alert_history
       WHERE tenant_id = $1
         AND created_at >= NOW() - INTERVAL '7 days'
       ORDER BY starts_at DESC
       LIMIT 10`,
      [tenantId]
    );

    return res.status(200).json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
      status: {
        state: overallState,
        label: statusLabel,
        all_clear: overallState === 'operational',
        updated_at: new Date().toISOString(),
      },
      items,
      recent_incidents: incidentsRes.rows,
    });
  } catch (err) {
    console.error('[Public Status Page Error]:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/public/badges/:tenantId/status.svg (Dynamic SVG Status Badge)
router.get('/badges/:tenantId/status.svg', async (req: Request, res: Response) => {
  const { tenantId } = req.params;

  try {
    const itemsRes = await adminQuery(
      'SELECT status FROM monitored_items WHERE tenant_id = $1',
      [tenantId]
    );

    let statusText = 'operational';
    let badgeColor = '#10b981'; // Green

    if (itemsRes.rows.length === 0) {
      statusText = 'no nodes';
      badgeColor = '#64748b'; // Slate
    } else if (itemsRes.rows.some((i) => i.status === 'red')) {
      statusText = 'outage';
      badgeColor = '#ef4444'; // Red
    } else if (itemsRes.rows.some((i) => i.status === 'yellow')) {
      statusText = 'degraded';
      badgeColor = '#f59e0b'; // Amber
    }

    const svg = generateShieldSvg('AllClear', statusText, badgeColor);

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).send(svg);
  } catch (err) {
    const errorSvg = generateShieldSvg('AllClear', 'unknown', '#64748b');
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    return res.status(200).send(errorSvg);
  }
});

/**
 * Generate Shields.io-style clean SVG badge markup
 */
function generateShieldSvg(leftLabel: string, rightValue: string, rightColor: string): string {
  const leftWidth = leftLabel.length * 7 + 16;
  const rightWidth = rightValue.length * 7 + 18;
  const totalWidth = leftWidth + rightWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${leftLabel}: ${rightValue}">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="${totalWidth}" height="20" rx="4" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    <rect width="${leftWidth}" height="20" fill="#1e293b"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${rightColor}"/>
    <rect width="${totalWidth}" height="20" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${(leftWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(leftWidth - 12) * 10}">
      ${leftLabel}
    </text>
    <text x="${(leftWidth / 2) * 10}" y="140" transform="scale(.1)" fill="#fff" textLength="${(leftWidth - 12) * 10}">
      ${leftLabel}
    </text>
    <text aria-hidden="true" x="${(leftWidth + rightWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(rightWidth - 12) * 10}">
      ${rightValue}
    </text>
    <text x="${(leftWidth + rightWidth / 2) * 10}" y="140" transform="scale(.1)" fill="#fff" textLength="${(rightWidth - 12) * 10}">
      ${rightValue}
    </text>
  </g>
</svg>`;
}

export default router;
