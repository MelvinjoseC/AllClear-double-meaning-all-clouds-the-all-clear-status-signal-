import { Router, Response } from 'express';
import { CustomRequest, authenticateToken } from '../middleware/auth';
import { withTenantClient } from '../db';

const router = Router();

// GET /api/audit-logs (Paginated audit logs for the authenticated tenant)
router.get('/', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user!;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const actionFilter = req.query.action as string;

  try {
    const result = await withTenantClient(user.tenantId, async (client) => {
      let query = `
        SELECT id, tenant_id, actor_email, action, resource_type, resource_id, details, ip_address, created_at
        FROM audit_logs
      `;
      const params: any[] = [];

      if (actionFilter) {
        query += ` WHERE action = $1`;
        params.push(actionFilter);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const dbRes = await client.query(query, params);

      const countRes = await client.query('SELECT COUNT(*) FROM audit_logs');
      return {
        total: parseInt(countRes.rows[0].count, 10),
        items: dbRes.rows,
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Failed to query audit logs:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
