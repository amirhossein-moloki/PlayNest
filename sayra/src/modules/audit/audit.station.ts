/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma, SessionActorType } from '@prisma/client';
import { AuditRepo } from './audit.repo';

export interface RecordLogInput {
  gamingCenterId?: string;
  userId?: string;
  customerId?: string;
  actorType?: SessionActorType;
  action: string;
  entity: string;
  entityId: string;
  oldData?: any;
  newData?: any;
  ipAddress?: string;
  userAgent?: string;
  tx?: Prisma.TransactionClient;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'code',
  'codehash',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'signingkey',
  'cardnumber',
  'cvv',
  'rawproviderpayload',
]);

/**
 * Recursively sanitizes data objects to strip sensitive security keys.
 */
export function sanitizeAuditData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeAuditData(value);
    }
  }

  return sanitized;
}

export const auditService = {
  /**
   * Helper to record audit logs from stations with sanitization and optional transaction support.
   */
  async log(
    gamingCenterId: string,
    actor: { id: string; actorType: SessionActorType },
    action: string,
    entity: { name: string; id: string },
    data: { old?: any; new?: any },
    context?: { ip?: string; userAgent?: string; tx?: Prisma.TransactionClient }
  ) {
    return this.recordLog({
      gamingCenterId,
      userId: actor.actorType === SessionActorType.USER ? actor.id : undefined,
      customerId: actor.actorType === SessionActorType.CUSTOMER ? actor.id : undefined,
      actorType: actor.actorType,
      action,
      entity: entity.name,
      entityId: entity.id,
      oldData: data.old,
      newData: data.new,
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
      tx: context?.tx,
    });
  },

  /**
   * Records an audit log entry.
   */
  async recordLog(data: RecordLogInput) {
    const sanitizedOld = sanitizeAuditData(data.oldData);
    const sanitizedNew = sanitizeAuditData(data.newData);

    try {
      return await AuditRepo.createLog(
        {
          gamingCenterId: data.gamingCenterId,
          userId: data.userId,
          customerId: data.customerId,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId,
          oldData: sanitizedOld ?? undefined,
          newData: sanitizedNew ?? undefined,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
        data.tx
      );
    } catch (error) {
      if (data.tx) {
        // If part of an atomic transaction, rethrow to enforce atomicity
        throw error;
      }
      console.error('Failed to record audit log:', error);
    }
  },

  /**
   * Retrieves audit logs for a gamingCenter with pagination.
   */
  async getLogs(
    gamingCenterId: string,
    query: {
      page?: number;
      pageSize?: number;
      action?: string;
      entity?: string;
      entityId?: string;
      userId?: string;
    }
  ) {
    const { page = 1, pageSize = 20, action, entity, entityId, userId } = query;
    const skip = (page - 1) * pageSize;

    const where = {
      gamingCenterId,
      action,
      entity,
      entityId,
      userId,
    };

    const [logs, totalItems] = await AuditRepo.transaction(async (tx) => {
      const l = await AuditRepo.findManyLogs(where, skip, pageSize, tx);
      const c = await AuditRepo.countLogs(where, tx);
      return [l, c] as const;
    });

    return {
      data: logs,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  },
};
