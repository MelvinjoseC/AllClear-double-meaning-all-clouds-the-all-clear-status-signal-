import { adminQuery } from '../db';
import { CustomRequest } from './auth';

export interface AuditLogEntry {
  tenantId: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Records an immutable compliance audit event.
 */
export async function recordAuditLog(
  tenantId: string,
  actorEmail: string,
  action: string,
  resourceType: string,
  resourceId: string | null = null,
  details: Record<string, any> = {},
  ipAddress: string = 'internal'
): Promise<void> {
  try {
    await adminQuery(
      `INSERT INTO audit_logs 
        (tenant_id, actor_email, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tenantId,
        actorEmail,
        action,
        resourceType,
        resourceId,
        JSON.stringify(details),
        ipAddress,
      ]
    );
  } catch (err) {
    // Non-fatal logging to ensure main transaction is not disrupted
    console.error('[AuditLog Error] Failed to write audit log entry:', err);
  }
}

/**
 * Convenience helper to extract actor email and client IP from an authenticated Express request.
 */
export async function auditRequest(
  req: CustomRequest,
  action: string,
  resourceType: string,
  resourceId: string | null = null,
  details: Record<string, any> = {}
): Promise<void> {
  const tenantId = req.user?.tenantId;
  const actorEmail = req.user?.email || 'system@allclear.internal';
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  if (!tenantId) {
    return;
  }

  await recordAuditLog(tenantId, actorEmail, action, resourceType, resourceId, details, clientIp);
}
