import argon2 from 'argon2';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { PlatformAdminRepo } from './platform-admin.repo';
import { Prisma } from '@prisma/client';
import { auditService } from '../audit/audit.station';
import { invalidateActorCache } from '../../common/middleware/auth';

export const PlatformAdminStation = {
  async getAllGamingCenters() {
    return PlatformAdminRepo.listAllGamingCenters();
  },

  async updateGamingCenterStatus(
    gamingCenterId: string,
    data: { isActive?: boolean; subscriptionStatus?: string },
    adminActor: { id: string },
    context?: { ip?: string; userAgent?: string }
  ) {
    const center = await PlatformAdminRepo.findGamingCenterById(gamingCenterId);
    if (!center) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }

    const updated = await PlatformAdminRepo.updateGamingCenter(gamingCenterId, data);

    await auditService.recordLog({
      gamingCenterId,
      platformAdminId: adminActor.id || (adminActor as any).actorId,
      action: 'PLATFORM_ADMIN_GAMING_CENTER_STATUS_UPDATE',
      entity: 'GamingCenter',
      entityId: gamingCenterId,
      oldData: { isActive: (center as any).isActive, subscriptionStatus: (center as any).subscriptionStatus },
      newData: data,
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    return updated;
  },

  async listUsers(query: {
    page: number;
    limit: number;
    gamingCenterId?: string;
    role?: string;
    search?: string;
    isActive?: boolean;
  }) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.UserWhereInput = {};

    if (query.gamingCenterId) {
      where.gamingCenterId = query.gamingCenterId;
    }
    if (query.role) {
      where.role = query.role as any;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }

    const { items, total } = await PlatformAdminRepo.listUsers({
      skip,
      take: query.limit,
      where,
    });

    const sanitizedItems = items.map((u: any) => {
      const { passwordHash: _, ...rest } = u;
      return rest;
    });

    return {
      items: sanitizedItems,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems: total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async updateUserStatus(
    userId: string,
    isActive: boolean,
    adminActor: { id: string },
    context?: { ip?: string; userAgent?: string }
  ) {
    const user = await PlatformAdminRepo.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', httpStatus.NOT_FOUND);
    }

    const updated = await PlatformAdminRepo.updateUser(userId, { isActive });
    await invalidateActorCache(userId, 'USER');

    await auditService.recordLog({
      gamingCenterId: user.gamingCenterId,
      platformAdminId: adminActor.id || (adminActor as any).actorId,
      action: 'PLATFORM_ADMIN_USER_STATUS_UPDATE',
      entity: 'User',
      entityId: userId,
      oldData: { isActive: user.isActive },
      newData: { isActive },
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    const { passwordHash: _, ...rest } = updated as any;
    return rest;
  },

  async resetUserPassword(
    userId: string,
    newPassword: string,
    adminActor: { id: string },
    context?: { ip?: string; userAgent?: string }
  ) {
    const user = await PlatformAdminRepo.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', httpStatus.NOT_FOUND);
    }

    const passwordHash = await argon2.hash(newPassword);
    await PlatformAdminRepo.updateUser(userId, { passwordHash });

    await PlatformAdminRepo.revokeUserSessions(userId);
    await invalidateActorCache(userId, 'USER');

    await auditService.recordLog({
      gamingCenterId: user.gamingCenterId,
      platformAdminId: adminActor.id || (adminActor as any).actorId,
      action: 'PLATFORM_ADMIN_USER_PASSWORD_RESET',
      entity: 'User',
      entityId: userId,
      oldData: null,
      newData: { reset: true },
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    return { message: 'Password reset successfully and existing sessions revoked' };
  },

  async revokeUserSessions(
    userId: string,
    adminActor: { id: string },
    context?: { ip?: string; userAgent?: string }
  ) {
    const user = await PlatformAdminRepo.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', httpStatus.NOT_FOUND);
    }

    const result = await PlatformAdminRepo.revokeUserSessions(userId);
    await invalidateActorCache(userId, 'USER');

    await auditService.recordLog({
      gamingCenterId: user.gamingCenterId,
      platformAdminId: adminActor.id || (adminActor as any).actorId,
      action: 'PLATFORM_ADMIN_USER_SESSIONS_REVOKE',
      entity: 'User',
      entityId: userId,
      oldData: null,
      newData: { revokedSessionsCount: result.count },
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    return { message: `Revoked ${result.count} active sessions` };
  },

  async listCustomers(query: { page: number; limit: number; search?: string }) {
    const skip = (query.page - 1) * query.limit;
    const { items, total } = await PlatformAdminRepo.listCustomers({
      skip,
      take: query.limit,
      search: query.search,
    });

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems: total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async getOperationsOverview() {
    return PlatformAdminRepo.getOperationsOverview();
  },

  async getFinancialsOverview() {
    return PlatformAdminRepo.getFinancialsOverview();
  },

  async listAuditLogs(query: {
    page: number;
    limit: number;
    gamingCenterId?: string;
    action?: string;
    entity?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.AuditLogWhereInput = {};

    if (query.gamingCenterId) {
      where.gamingCenterId = query.gamingCenterId;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.entity) {
      where.entity = query.entity;
    }
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const { items, total } = await PlatformAdminRepo.listAuditLogs({
      skip,
      take: query.limit,
      where,
    });

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems: total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },
};
