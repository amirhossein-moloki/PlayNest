
import { Response, NextFunction } from 'express';
import { auditService } from './audit.station';
import { ListAuditLogsQuery } from './audit.validators';
import { AppRequest } from '../../types/express';

export const getAuditLogs = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { gamingCenterId } = req.params;
    const query = req.query as unknown as ListAuditLogsQuery;

    const result = await auditService.getLogs(gamingCenterId, query);

    res.ok(result.data, {
      pagination: {
        page: result.meta.page,
        pageSize: result.meta.pageSize,
        totalItems: result.meta.totalItems,
        totalPages: result.meta.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};
