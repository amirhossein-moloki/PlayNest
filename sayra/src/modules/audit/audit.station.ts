
import { SessionActorType } from '@prisma/client';
import { AuditRepo } from './audit.repo';

export interface RecordLogInput {
  gamingCenterId?: string;
  userId?: string;
  customerId?: string;
  actorType?: SessionActorType;
  action: string;
  entity: string;
  entityId: string;
  oldData?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  newData?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  ipAddress?: string;
  userAgent?: string;
}

export const auditService = {
  /**
   * A simplified helper to record audit logs from stations.
   */
  async log(
    gamingCenterId: string,
    actor: { id: string; actorType: SessionActorType },
    action: string,
    entity: { name: string; id: string },
    data: { old?: any; new?: any }, // eslint-disable-line @typescript-eslint/no-explicit-any
    context?: { ip?: string; userAgent?: string }
  ) {
    return this.recordLog({
      gamingCenterId,
      userId: actor.id,
      actorType: actor.actorType,
      action,
      entity: entity.name,
      entityId: entity.id,
      oldData: data.old,
      newData: data.new,
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });
  },

  /**
   * Records an audit log entry.
   * This is generally called by other stations when a sensitive action is performed.
   */
  async recordLog(data: RecordLogInput) {
    try {
      return await AuditRepo.createLog({
        gamingCenterId: data.gamingCenterId,
        userId: data.userId,
        customerId: data.customerId,

        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        oldData: data.oldData ?? undefined,
        newData: data.newData ?? undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
    } catch (error) {
      // We don't want to fail the main transaction if audit logging fails,
      // but we should log it. In a production system, we might use a queue.
      console.error('Failed to record audit log:', error);
    }
  },

  /**
   * Retrieves audit logs for a gamingCenter with pagination.
   */
  async getLogs(gamingCenterId: string, query: {
    page?: number;
    pageSize?: number;
    action?: string;
    entity?: string;
    entityId?: string;
    userId?: string;
  }) {
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
