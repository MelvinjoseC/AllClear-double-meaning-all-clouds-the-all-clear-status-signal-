import { Router, Response } from 'express';
import pool, { withTenantClient, adminQuery } from '../db';
import { CustomRequest, authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * Check if a monitored node is currently within an active scheduled maintenance window.
 */
export async function isItemInMaintenance(tenantId: string, monitoredItemId: string): Promise<boolean> {
  try {
    const res = await adminQuery(
      `SELECT 1 FROM maintenance_windows
       WHERE tenant_id = $1 
         AND is_active = true
         AND NOW() BETWEEN start_time AND end_time
         AND (monitored_item_id = $2 OR monitored_item_id IS NULL)
       LIMIT 1`,
      [tenantId, monitoredItemId]
    );
    return res.rows.length > 0;
  } catch (err) {
    console.error('[Maintenance Check Error]:', err);
    return false;
  }
}

// GET /api/maintenance-windows (List all maintenance windows for current tenant)
router.get('/', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  try {
    const windows = await withTenantClient(user.tenantId, async (client) => {
      const dbRes = await client.query(
        `SELECT m.*, i.name as item_name, i.type as item_type
         FROM maintenance_windows m
         LEFT JOIN monitored_items i ON m.monitored_item_id = i.id
         ORDER BY m.start_time DESC`
      );
      return dbRes.rows;
    });
    return res.status(200).json(windows);
  } catch (err) {
    console.error('Failed to retrieve maintenance windows:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/maintenance-windows (Schedule new maintenance window)
router.post('/', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  const { name, monitored_item_id, start_time, end_time, reason } = req.body;

  if (!name || !start_time || !end_time) {
    return res.status(400).json({ error: 'Name, start_time, and end_time are required.' });
  }

  const startDate = new Date(start_time);
  const endDate = new Date(end_time);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format. Use ISO-8601 strings.' });
  }

  if (endDate <= startDate) {
    return res.status(400).json({ error: 'end_time must be after start_time.' });
  }

  try {
    const created = await withTenantClient(user.tenantId, async (client) => {
      const dbRes = await client.query(
        `INSERT INTO maintenance_windows (tenant_id, name, monitored_item_id, start_time, end_time, reason, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
        [user.tenantId, name, monitored_item_id || null, startDate.toISOString(), endDate.toISOString(), reason || '']
      );
      return dbRes.rows[0];
    });

    return res.status(201).json({ message: 'Maintenance window scheduled successfully.', window: created });
  } catch (err) {
    console.error('Failed to create maintenance window:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/maintenance-windows/:id (Cancel/Delete maintenance window)
router.delete('/:id', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  try {
    const deleted = await withTenantClient(user.tenantId, async (client) => {
      const dbRes = await client.query(
        'DELETE FROM maintenance_windows WHERE id = $1 RETURNING *',
        [id]
      );
      return dbRes.rows[0];
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Maintenance window not found or unauthorized.' });
    }

    return res.status(200).json({ message: 'Maintenance window removed.' });
  } catch (err) {
    console.error('Failed to delete maintenance window:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
