import { Response, NextFunction } from 'express';
import { AppRequest } from '../../types/express';
import { PlatformAdminStation } from './platform-admin.station';
import {
  listPlatformUsersQuerySchema,
  updatePlatformUserStatusSchema,
  resetUserPasswordSchema,
  updateGamingCenterStatusSchema,
  updatePlatformGamingCenterSchema,
  listPlatformAuditLogsQuerySchema,
  listPlatformCustomersQuerySchema,
  listPlatformReservationsQuerySchema,
  cancelPlatformReservationSchema,
} from './platform-admin.validators';
import { AdminStationBridge } from '../../platform-admin/services/admin-station-bridge';
import { gamingCenterStation } from '../gamingCenter/gamingCenter.station';
import { createGamingCenterSchema } from '../gamingCenter/gamingCenter.validation';

export const PlatformAdminController = {
  async getAllGamingCenters(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const search = req.query.search as string | undefined;

      const result = await PlatformAdminStation.getAllGamingCenters({ page, limit, search });
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

  async listPayments(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const status = req.query.status as import('@prisma/client').PaymentStatus | undefined;
      const gamingCenterId = req.query.gamingCenterId as string | undefined;

      const where: import('@prisma/client').Prisma.PaymentWhereInput = {};
      if (status) where.status = status;
      if (gamingCenterId) where.gamingCenterId = gamingCenterId;

      const [items, total] = await Promise.all([
        (await import('../../config/prisma')).prisma.payment.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            gamingCenter: { select: { id: true, name: true, slug: true } },
            reservation: { select: { id: true, status: true, startTime: true, endTime: true } },
            refunds: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        (await import('../../config/prisma')).prisma.payment.count({ where }),
      ]);

      res.ok(items, {
        pagination: {
          page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async listRefunds(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const status = req.query.status as import('@prisma/client').RefundStatus | undefined;
      const gamingCenterId = req.query.gamingCenterId as string | undefined;

      const where: import('@prisma/client').Prisma.RefundWhereInput = {};
      if (status) where.status = status;
      if (gamingCenterId) where.gamingCenterId = gamingCenterId;

      const [items, total] = await Promise.all([
        (await import('../../config/prisma')).prisma.refund.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            payment: {
              select: {
                id: true,
                amount: true,
                status: true,
                method: true,
                provider: true,
              },
            },
            gamingCenter: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        (await import('../../config/prisma')).prisma.refund.count({ where }),
      ]);

      res.ok(items, {
        pagination: {
          page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async retryRefund(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await AdminStationBridge.retryRefund(id, {
        platformAdminId: req.actor.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async reconcilePayment(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const payment = await (await import('../../config/prisma')).prisma.payment.findUnique({
        where: { id },
        select: { id: true, gamingCenterId: true },
      });
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      const result = await AdminStationBridge.reconcilePayment(payment.gamingCenterId, id, {
        platformAdminId: req.actor.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async exportFinancialCsv(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const payments = await (await import('../../config/prisma')).prisma.payment.findMany({
        take: 1000,
        orderBy: { createdAt: 'desc' },
        include: {
          gamingCenter: { select: { name: true } },
        },
      });

      const header = 'ID,GamingCenter,Amount,Currency,Status,Method,Provider,CreatedAt\n';
      const rows = payments
        .map((p) =>
          `"${p.id}","${p.gamingCenter?.name || ''}",${p.amount},"${p.currency}","${p.status}","${p.method}","${p.provider}","${p.createdAt.toISOString()}"`
        )
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="playnest-financial-export.csv"');
      res.send(header + rows);
    } catch (err) {
      next(err);
    }
  },

  async listReservations(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const query = listPlatformReservationsQuerySchema.parse(req.query);
      const result = await PlatformAdminStation.listReservations({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        search: query.search,
        city: query.city,
        gamingCenterId: query.gamingCenterId,
        customerId: query.customerId,
        status: query.status,
        startDate: query.startDate,
        endDate: query.endDate,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });
      res.ok(result.items, {
        pagination: {
          page: result.pagination.page,
          pageSize: result.pagination.limit,
          total: result.pagination.total,
          totalItems: result.pagination.totalItems,
          totalPages: result.pagination.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async createUser(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { createPlatformUserSchema } = await import('./platform-admin.validators');
      const parsed = createPlatformUserSchema.parse({ body: req.body });
      const result = await PlatformAdminStation.createUser(
        parsed.body,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateUser(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { updatePlatformUserSchema } = await import('./platform-admin.validators');
      const parsed = updatePlatformUserSchema.parse({ params: req.params, body: req.body });
      const result = await PlatformAdminStation.updateUser(
        parsed.params.id,
        parsed.body,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async deleteUser(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await PlatformAdminStation.deleteUser(
        id,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async getGamingCenterById(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const center = await PlatformAdminStation.getGamingCenterById(id);
      res.ok(center);
    } catch (err) {
      next(err);
    }
  },

  async createGamingCenter(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const validated = createGamingCenterSchema.parse(req.body);
      const actor = {
        id: req.actor.id,
        actorType: req.actor.actorType,
        isSuperuser: true,
      };
      const center = await gamingCenterStation.createGamingCenter(
        validated,
        actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.status(201).json({ success: true, data: center });
    } catch (err) {
      next(err);
    }
  },

  async cancelReservation(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = cancelPlatformReservationSchema.parse(req.body);
      const reservation = await (await import('../../config/prisma')).prisma.reservation.findUnique({
        where: { id },
        select: { id: true, gamingCenterId: true },
      });
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }

      const result = await AdminStationBridge.cancelReservation(
        reservation.gamingCenterId,
        id,
        validated.reason,
        {
          platformAdminId: req.actor.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
        }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async confirmReservation(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const reservation = await (await import('../../config/prisma')).prisma.reservation.findUnique({
        where: { id },
        select: { id: true, gamingCenterId: true },
      });
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }

      const result = await AdminStationBridge.confirmReservation(
        reservation.gamingCenterId,
        id,
        {
          platformAdminId: req.actor.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
        }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async startReservation(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const reservation = await (await import('../../config/prisma')).prisma.reservation.findUnique({
        where: { id },
        select: { id: true, gamingCenterId: true },
      });
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }

      const result = await AdminStationBridge.startReservation(
        reservation.gamingCenterId,
        id,
        {
          platformAdminId: req.actor.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
        }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async completeReservation(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const reservation = await (await import('../../config/prisma')).prisma.reservation.findUnique({
        where: { id },
        select: { id: true, gamingCenterId: true },
      });
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }

      const result = await AdminStationBridge.completeReservation(
        reservation.gamingCenterId,
        id,
        {
          platformAdminId: req.actor.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
        }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async markNoShowReservation(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const reservation = await (await import('../../config/prisma')).prisma.reservation.findUnique({
        where: { id },
        select: { id: true, gamingCenterId: true },
      });
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }

      const result = await AdminStationBridge.markNoShow(
        reservation.gamingCenterId,
        id,
        {
          platformAdminId: req.actor.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
        }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async updateGamingCenter(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = updatePlatformGamingCenterSchema.parse(req).body;
      const updated = await PlatformAdminStation.updateGamingCenter(
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
