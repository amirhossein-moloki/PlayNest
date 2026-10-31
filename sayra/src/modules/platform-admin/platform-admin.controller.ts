import { Response, NextFunction } from 'express';
import { AppRequest } from '../../types/express';
import { PlatformAdminStation } from './platform-admin.station';
import {
  listPlatformUsersQuerySchema,
  updatePlatformUserStatusSchema,
  resetUserPasswordSchema,
  updateGamingCenterStatusSchema,
  listPlatformAuditLogsQuerySchema,
  listPlatformCustomersQuerySchema,
} from './platform-admin.validators';

export const PlatformAdminController = {
  async getAllGamingCenters(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const centers = await PlatformAdminStation.getAllGamingCenters();
      res.ok(centers);
    } catch (err) {
      next(err);
    }
  },

  async updateGamingCenterStatus(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = updateGamingCenterStatusSchema.parse(req).body;
      const updated = await PlatformAdminStation.updateGamingCenterStatus(
        id,
        validated,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.ok(updated);
    } catch (err) {
      next(err);
    }
  },

  async listUsers(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const query = listPlatformUsersQuerySchema.parse(req.query);
      const result = await PlatformAdminStation.listUsers({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        gamingCenterId: query.gamingCenterId,
        role: query.role,
        search: query.search,
        isActive: query.isActive,
      });
      res.ok(result.items, {
        pagination: {
          page: result.pagination.page,
          pageSize: result.pagination.limit,
          totalItems: result.pagination.totalItems,
          totalPages: result.pagination.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async updateUserStatus(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = updatePlatformUserStatusSchema.parse(req).body;
      const updated = await PlatformAdminStation.updateUserStatus(
        id,
        validated.isActive,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.ok(updated);
    } catch (err) {
      next(err);
    }
  },

  async resetUserPassword(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = resetUserPasswordSchema.parse(req).body;
      const result = await PlatformAdminStation.resetUserPassword(
        id,
        validated.newPassword,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async revokeUserSessions(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await PlatformAdminStation.revokeUserSessions(
        id,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async listCustomers(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const query = listPlatformCustomersQuerySchema.parse(req.query);
      const result = await PlatformAdminStation.listCustomers({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        search: query.search,
      });
      res.ok(result.items, {
        pagination: {
          page: result.pagination.page,
          pageSize: result.pagination.limit,
          totalItems: result.pagination.totalItems,
          totalPages: result.pagination.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async getOperationsOverview(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const overview = await PlatformAdminStation.getOperationsOverview();
      res.ok(overview);
    } catch (err) {
      next(err);
    }
  },

  async getFinancialsOverview(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const overview = await PlatformAdminStation.getFinancialsOverview();
      res.ok(overview);
    } catch (err) {
      next(err);
    }
  },

  async listAuditLogs(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const query = listPlatformAuditLogsQuerySchema.parse(req.query);
      const result = await PlatformAdminStation.listAuditLogs({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        gamingCenterId: query.gamingCenterId,
        action: query.action,
        entity: query.entity,
        userId: query.userId,
        startDate: query.startDate,
        endDate: query.endDate,
      });
      res.ok(result.items, {
        pagination: {
          page: result.pagination.page,
          pageSize: result.pagination.limit,
          totalItems: result.pagination.totalItems,
          totalPages: result.pagination.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
