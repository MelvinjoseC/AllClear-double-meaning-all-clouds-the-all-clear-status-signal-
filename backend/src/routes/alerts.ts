import { Router, Request, Response } from 'express';
import pool, { adminQuery, withTenantClient } from '../db';
import { sendAlert, AlertNotification } from '../services/notifier';
import { CustomRequest, authenticateToken } from '../middleware/auth';

const router = Router();

// POST /internal/alerts/webhook (Alertmanager ingestion endpoint - fully internal-only)
router.post('/webhook', async (req: Request, res: Response) => {
  const payload = req.body;

  if (!payload || !payload.alerts) {
    return res.status(400).json({ error: 'Invalid Alertmanager payload' });
  }

  console.log(`[ALERT MANAGER WEBHOOK] Received ${payload.alerts.length} alert notifications.`);

  for (const alert of payload.alerts) {
    const labels = alert.labels || {};
    const alertName = labels.alertname;
    const tenantId = labels.tenant_id;
    const monitoredItemId = labels.monitored_item_id;
    const severity = labels.severity || 'critical';
    const status = alert.status; // 'firing' or 'resolved'
    const startsAt = alert.startsAt;
    const endsAt = status === 'resolved' ? alert.endsAt : null;

    if (!alertName || !tenantId || !monitoredItemId) {
      console.warn('[ALERT WEBHOOK] Warning: Missing labels (alertname, tenant_id, or monitored_item_id). Skipping alert.', labels);
      continue;
    }

    try {
      // 1. Fetch item name and type
      const itemRes = await adminQuery(
        'SELECT name, type, status FROM monitored_items WHERE id = $1',
        [monitoredItemId]
      );
      if (itemRes.rows.length === 0) {
        console.warn(`[ALERT WEBHOOK] Monitored item ${monitoredItemId} not found. Skipping.`);
        continue;
      }
      const item = itemRes.rows[0];

      // Determine value to display (e.g. CPU %, response time, etc.)
      let value = '';
      if (alert.annotations && alert.annotations.description) {
        // Parse a value if present in description (e.g. "CPU usage is 94.20%")
        const match = alert.annotations.description.match(/(\d+(\.\d+)?)/);
        if (match) value = match[1];
      }

      // 2. Fetch tenant notifications targets (Primary user email and tenant WhatsApp number)
      const tenantRes = await adminQuery(
        'SELECT name, whatsapp_number FROM tenants WHERE id = $1',
        [tenantId]
      );
      if (tenantRes.rows.length === 0) {
        console.warn(`[ALERT WEBHOOK] Tenant ${tenantId} not found. Skipping.`);
        continue;
      }
      const tenant = tenantRes.rows[0];

      const userRes = await adminQuery(
        'SELECT email FROM users WHERE tenant_id = $1 LIMIT 1',
        [tenantId]
      );
      if (userRes.rows.length === 0) {
        console.warn(`[ALERT WEBHOOK] No users found for Tenant ${tenantId}. Skipping dispatch.`);
        continue;
      }
      const userEmail = userRes.rows[0].email;

      // 3. Process Status Transitions in DB & Form Plain-English Message
      const notification: AlertNotification = {
        alertName,
        monitoredItemName: item.name,
        status,
        severity,
        value,
        timestamp: endsAt || startsAt
      };

      const { message, action } = require('../services/notifier').translateAlert(notification);

      if (status === 'firing') {
        // Insert alert into history log
        await adminQuery(
          `INSERT INTO alert_history (tenant_id, monitored_item_id, alert_name, severity, status, message, suggested_action, starts_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [tenantId, monitoredItemId, alertName, severity, status, message, action, startsAt]
        );

        // Update monitored item status
        // Critical alerts turn red, warnings turn yellow
        const newStatus = severity === 'critical' ? 'red' : 'yellow';
        await adminQuery(
          'UPDATE monitored_items SET status = $1, last_checked_at = NOW() WHERE id = $2',
          [newStatus, monitoredItemId]
        );
      } else {
        // Resolved alert: Update existing firing entry
        await adminQuery(
          `UPDATE alert_history 
           SET status = 'resolved', ends_at = $1 
           WHERE monitored_item_id = $2 AND alert_name = $3 AND status = 'firing'`,
          [endsAt, monitoredItemId, alertName]
        );

        // Check if there are any remaining firing alerts for this monitored item
        const activeAlerts = await adminQuery(
          "SELECT severity FROM alert_history WHERE monitored_item_id = $1 AND status = 'firing'",
          [monitoredItemId]
        );

        let finalStatus = 'green';
        if (activeAlerts.rows.length > 0) {
          // If there are still active alerts, set to the highest severity remaining
          const hasCritical = activeAlerts.rows.some(a => a.severity === 'critical');
          finalStatus = hasCritical ? 'red' : 'yellow';
        }

        await adminQuery(
          'UPDATE monitored_items SET status = $1, last_checked_at = NOW() WHERE id = $2',
          [finalStatus, monitoredItemId]
        );
      }

      // 4. Send notifications
      await sendAlert(tenantId, userEmail, tenant.whatsapp_number, notification);

    } catch (err) {
      console.error('[ALERT WEBHOOK ERROR] Failed to process alert event:', err);
    }
  }

  return res.status(200).json({ status: 'ok' });
});

// GET /api/alerts/history (Retrieve plain-English log for current tenant)
router.get('/history', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  try {
    const history = await withTenantClient(user.tenantId, async (client) => {
      const dbRes = await client.query(
        `SELECT h.*, m.name as item_name, m.type as item_type 
         FROM alert_history h
         JOIN monitored_items m ON h.monitored_item_id = m.id
         ORDER BY h.created_at DESC`
      );
      return dbRes.rows;
    });

    return res.status(200).json(history);
  } catch (err) {
    console.error('Failed to get alert history:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
