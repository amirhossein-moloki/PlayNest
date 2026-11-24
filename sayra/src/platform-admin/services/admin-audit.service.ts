/* eslint-disable @typescript-eslint/no-explicit-any */
import { auditService } from '../../modules/audit/audit.station';
import logger from '../../config/logger';

export interface AdminAuditParams {
  platformAdminId?: string;
  action: string;
  entity: string;
  entityId: string;
  oldData?: any;
  newData?: any;
  ipAddress?: string;
  userAgent?: string;
}

function sanitizeAuditPayload(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeAuditPayload);
  }

  const sensitiveKeys = new Set([
    'password',
    'passwordhash',
    'currentpassword',
    'passwordconfirm',
    'code',
    'codehash',
    'totpcode',
    'secret',
    'secretkey',
    'secretencrypted',
    'totpsecret',
    'totpsecretencrypted',
    'totppendingsecretencrypted',
    'manualentrykey',
    'otpauthurl',
    'recoverycode',
    'recoverycodes',
    'token',
    'accesstoken',
    'refreshtoken',
    'challengetoken',
    'setuptoken',
    'otp',
    'authorization',
    'apikey',
    'idempotencykey',
    'deduplicationkey',
  ]);

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditPayload(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class AdminAuditService {
  /**
   * Records an administrative audit trail event.
   * Sanitizes all sensitive data before persistence and logs errors reliably.
   * @throws Error if throwOnError is true (e.g. for critical administrative changes)
   */
  static async logAdminEvent(params: AdminAuditParams, options?: { throwOnError?: boolean }): Promise<void> {
    try {
      const sanitizedOldData = sanitizeAuditPayload(params.oldData);
      const sanitizedNewData = sanitizeAuditPayload(params.newData);

      await auditService.recordLog({
        platformAdminId: params.platformAdminId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldData: sanitizedOldData,
        newData: sanitizedNewData,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
    } catch (err) {
      logger.error({ err, params }, 'CRITICAL: Failed to record administrative audit log');
      if (options?.throwOnError) {
        throw new Error(`Failed to record mandatory audit log for action: ${params.action}`);
      }
    }
  }
}
