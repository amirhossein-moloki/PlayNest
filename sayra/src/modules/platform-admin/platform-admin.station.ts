/* eslint-disable @typescript-eslint/no-explicit-any */
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

  async getGamingCenterById(gamingCenterId: string) {
    const center = await PlatformAdminRepo.findGamingCenterById(gamingCenterId);
    if (!center) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }
    return center;
  },

  async updateGamingCenter(
    gamingCenterId: string,
    data: {
      name?: string;
      slug?: string;
      isActive?: boolean;
      subscriptionStatus?: string;
      games?: string[];
      ownerId?: string;
    },
    adminActor: { id: string },
    context?: { ip?: string; userAgent?: string }
  ) {
    const center = await PlatformAdminRepo.findGamingCenterById(gamingCenterId);
    if (!center) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }

    if (data.slug && data.slug !== center.slug) {
      const existing = await PlatformAdminRepo.findGamingCenterBySlug(data.slug);
      if (existing) {
        throw new AppError('A gamingCenter with this slug already exists', httpStatus.CONFLICT);
      }
    }

    const updated = await PlatformAdminRepo.updateGamingCenter(gamingCenterId, data);

    await auditService.recordLog({
      gamingCenterId,
      platformAdminId: adminActor.id || (adminActor as any).actorId,
      action: 'PLATFORM_ADMIN_GAMING_CENTER_UPDATE',
      entity: 'GamingCenter',
      entityId: gamingCenterId,
      oldData: {
        name: (center as any).name,
        slug: (center as any).slug,
        isActive: (center as any).isActive,
        subscriptionStatus: (center as any).subscriptionStatus,
      },
      newData: data,
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    return updated;
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
      const { passwordHash: _passwordHash, ...rest } = u; void _passwordHash;
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

    const { passwordHash: _passwordHash, ...rest } = updated as any; void _passwordHash;
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

  async listReservations(query: {
    page: number;
    limit: number;
    search?: string;
    city?: string;
    gamingCenterId?: string;
    customerId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    sortBy: 'startTime' | 'endTime' | 'createdAt' | 'totalPrice' | 'status';
    sortOrder: 'asc' | 'desc';
  }) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.ReservationWhereInput = {};

    if (query.gamingCenterId) {
      where.gamingCenterId = query.gamingCenterId;
    }

    if (query.customerId) {
      where.customerAccountId = query.customerId;
    }

    if (query.city) {
      where.gamingCenter = {
        addresses: {
          some: {
            city: {
              contains: query.city,
              mode: 'insensitive',
            },
          },
        },
      } as any;
    }

    if (query.status) {
      const normalizedStatus = query.status.toUpperCase();
      if (normalizedStatus === 'PAID') {
        where.paymentState = 'PAID' as any;
      } else if (normalizedStatus === 'CANCELLED' || normalizedStatus === 'CANCELED') {
        where.status = 'CANCELED' as any;
      } else if (normalizedStatus === 'REJECTED') {
        where.status = 'CANCELED' as any;
      } else {
        where.status = normalizedStatus as any;
      }
    }

    if (query.startDate || query.endDate) {
      where.startTime = {};
      if (query.startDate) {
        where.startTime.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.startTime.lte = new Date(query.endDate);
      }
    }

    if (query.search) {
      const search = query.search;
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { customerAccount: { phone: { contains: search } } },
        { customerAccount: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const { items, total } = await PlatformAdminRepo.listReservations({
      skip,
      take: query.limit,
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
    });

    const formattedItems = items.map((r: any) => {
      // Find primary city or first address city
      const addresses = r.gamingCenter?.addresses || [];
      const primaryAddress = addresses.find((a: any) => a.isPrimary) || addresses[0];
      const city = primaryAddress?.city || null;

      // Find latest or successful payment
      const payment = r.payments && r.payments.length > 0 ? r.payments[0] : null;

      const durationHours = r.totalHours ?? null;

      // Calculate finalPrice
      const finalPrice = r.customerPayableAmount !== undefined && r.customerPayableAmount !== null
        ? r.customerPayableAmount
        : Math.max(0, (r.totalPrice || 0) - (r.discountAmount || 0));

      const reservationDate = r.startTime
        ? new Date(r.startTime).toISOString().split('T')[0]
        : null;

      return {
        id: r.id,
        reservationCode: r.id.startsWith('res_') || r.id.startsWith('cuid_res_')
          ? `RES-${r.id.split('_').pop()!.toUpperCase()}`
          : `RES-${r.id.slice(-6).toUpperCase()}`,
        status: r.status,
        startTime: r.startTime ? new Date(r.startTime).toISOString() : null,
        endTime: r.endTime ? new Date(r.endTime).toISOString() : null,
        reservationDate,
        duration: durationHours,
        totalPrice: r.totalPrice,
        discountAmount: r.discountAmount || 0,
        finalPrice,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
        customer: r.customerAccount
          ? {
            id: r.customerAccount.id,
            fullName: r.customerAccount.fullName || '',
            phone: r.customerAccount.phone || '',
            email: null,
          }
          : null,
        gamingCenter: r.gamingCenter
          ? {
            id: r.gamingCenter.id,
            name: r.gamingCenter.name,
            slug: r.gamingCenter.slug,
            city,
          }
          : null,
        station: r.station
          ? {
            id: r.station.id,
            name: r.station.name,
            type: r.station.stationType,
          }
          : null,
        payment: payment
          ? {
            id: payment.id,
            status: payment.status,
            amount: payment.amount,
            method: payment.method,
            transactionId: payment.providerPaymentId || payment.referenceCode || null,
            paidAt: payment.paidAt ? new Date(payment.paidAt).toISOString() : null,
          }
          : null,
        discount: r.discount
          ? {
            id: r.discount.id,
            code: r.discount.code,
            percentage: r.discount.percentage,
            fixedAmount: r.discount.fixedAmount,
            discountType: r.discount.discountType,
          }
          : null,
      };
    });

    return {
      items: formattedItems,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems: total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },
};
