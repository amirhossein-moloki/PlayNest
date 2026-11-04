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
    sortBy?: string;
    sortOrder?: string;
  }) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.ReservationWhereInput = {};

    if (query.gamingCenterId) {
      where.gamingCenterId = query.gamingCenterId;
    }

    if (query.customerId) {
      where.OR = [
        { customerAccountId: query.customerId },
        { customerProfileId: query.customerId },
      ];
    }

    if (query.city) {
      where.gamingCenter = {
        addresses: {
          some: {
            city: { contains: query.city, mode: 'insensitive' },
          },
        },
      };
    }

    if (query.status) {
      if (query.status === 'CANCELLED' || query.status === 'CANCELED') {
        where.status = 'CANCELED';
      } else if (query.status === 'PAID') {
        where.paymentState = 'PAID';
      } else if (query.status === 'REJECTED') {
        where.status = 'CANCELED';
      } else {
        where.status = query.status as any;
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
      const searchConditions: Prisma.ReservationWhereInput[] = [
        { id: { contains: query.search, mode: 'insensitive' } },
        {
          customerAccount: {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          },
        },
        {
          customerProfile: {
            displayName: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const sortField = query.sortBy === 'finalPrice' ? 'customerPayableAmount' : (query.sortBy || 'startTime');
    const sortDir = (query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const orderBy = { [sortField]: sortDir };

    const { items, total } = await PlatformAdminRepo.listReservations({
      skip,
      take: query.limit,
      where,
      orderBy: orderBy as any,
    });

    const transformedItems = items.map((resItem: any) => {
      const primaryAddress = resItem.gamingCenter?.addresses?.find((a: any) => a.isPrimary) || resItem.gamingCenter?.addresses?.[0];
      const city = primaryAddress?.city || null;

      const latestPayment = resItem.payments?.[0];
      const paymentInfo = latestPayment
        ? {
          id: latestPayment.id,
          status: latestPayment.status,
          amount: latestPayment.amount,
          method: latestPayment.method,
          transactionId: latestPayment.providerPaymentId || latestPayment.id,
          paidAt: latestPayment.paidAt,
        }
        : null;

      const customerName = resItem.customerAccount?.fullName || resItem.customerProfile?.displayName || null;
      const finalPrice = resItem.customerPayableAmount ?? (resItem.totalPrice - (resItem.discountAmount || 0));

      return {
        id: resItem.id,
        reservationCode: resItem.id,
        status: resItem.status,
        startTime: resItem.startTime,
        endTime: resItem.endTime,
        reservationDate: resItem.startTime,
        duration: resItem.totalHours,
        totalPrice: resItem.totalPrice,
        discountAmount: resItem.discountAmount || 0,
        finalPrice,
        paymentState: resItem.paymentState,
        customer: resItem.customerAccount
          ? {
            id: resItem.customerAccount.id,
            fullName: customerName,
            phone: resItem.customerAccount.phone,
            email: null,
          }
          : null,
        gamingCenter: resItem.gamingCenter
          ? {
            id: resItem.gamingCenter.id,
            name: resItem.gamingCenter.name,
            slug: resItem.gamingCenter.slug,
            city,
          }
          : null,
        station: resItem.station
          ? {
            id: resItem.station.id,
            name: resItem.station.name,
            type: resItem.station.stationType,
          }
          : null,
        payment: paymentInfo,
        discount: resItem.discount
          ? {
            id: resItem.discount.id,
            value: resItem.discount.value,
            valueType: resItem.discount.valueType,
          }
          : null,
        discountCampaign: resItem.campaign
          ? {
            id: resItem.campaign.id,
            code: resItem.campaign.code,
            name: resItem.campaign.name,
          }
          : null,
        voucherCode: resItem.voucherCode || null,
        createdAt: resItem.createdAt,
        updatedAt: resItem.updatedAt,
      };
    });

    return {
      items: transformedItems,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: total,
        totalItems: total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  },
};
