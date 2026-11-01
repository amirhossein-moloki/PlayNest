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

export class AdminAuditService {
  static async logAdminEvent(params: AdminAuditParams): Promise<void> {
    try {
      await auditService.recordLog({
        platformAdminId: params.platformAdminId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldData: params.oldData,
        newData: params.newData,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
    } catch (err) {
      logger.error({ err, params }, 'Failed to record administrative audit log');
    }
  }
}
