/* eslint-disable @typescript-eslint/no-explicit-any */
import argon2 from 'argon2';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { PlatformAdminRepo } from './platform-admin.repo';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.station';
import { invalidateActorCache } from '../../common/middleware/auth';

export const PlatformAdminStation = {
  async getAllGamingCenters(query?: { page?: number; limit?: number; search?: string }) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const skip = (page - 1) * limit;

    const { items, total } = await PlatformAdminRepo.listAllGamingCenters({
      skip,
      take: limit,
      search: query?.search,
    });

    const formatted = items.map((gc: any) => {
      const primaryOwner = gc.users && gc.users.length > 0 ? gc.users[0] : null;
      const primaryAddress = gc.addresses && gc.addresses.length > 0 ? gc.addresses[0] : null;

      let owner = null;
      if (primaryOwner) {
        const parts = (primaryOwner.fullName || '').trim().split(' ');
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        owner = {
          id: primaryOwner.id,
          firstName,
          lastName,
          fullName: primaryOwner.fullName,
          phone: primaryOwner.phone,
          email: primaryOwner.email,
        };
      }

      let address = null;
      if (primaryAddress) {
        address = {
          id: primaryAddress.id,
          title: primaryAddress.title,
          city: primaryAddress.city,
          province: primaryAddress.province,
          fullAddress: primaryAddress.addressLine,
          postalCode: primaryAddress.postalCode,
          latitude: primaryAddress.lat ? Number(primaryAddress.lat) : null,
          longitude: primaryAddress.lng ? Number(primaryAddress.lng) : null,
        };
      }

      return {
        ...gc,
        owner,
        address,
      };
    });

    return {
      items: formatted,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
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

  async createUser(
    data: import('./platform-admin.validators').CreatePlatformUserInput,
    adminActor: { id: string },
    context?: { ip?: string; userAgent?: string }
  ) {
    // 1. Verify Gaming Center exists
    const gamingCenter = await PlatformAdminRepo.findGamingCenterById(data.gamingCenterId);
    if (!gamingCenter) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }

    // 2. Check phone uniqueness within Gaming Center
    const existingPhone = await (prisma as any).user.findFirst({
      where: {
        gamingCenterId: data.gamingCenterId,
        phone: data.phone,
      },
    });
    if (existingPhone) {
      throw new AppError('A user with this phone number already exists in this gaming center', httpStatus.CONFLICT);
    }

    // 3. Check email uniqueness within Gaming Center if email provided
    if (data.email) {
      const existingEmail = await (prisma as any).user.findFirst({
        where: {
          gamingCenterId: data.gamingCenterId,
          email: data.email,
        },
      });
      if (existingEmail) {
        throw new AppError('A user with this email already exists in this gaming center', httpStatus.CONFLICT);
      }
    }

    // 4. Hash password
    const passwordHash = data.password ? await argon2.hash(data.password) : null;
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim();

    const created = await PlatformAdminRepo.createUser({
      gamingCenterId: data.gamingCenterId,
      fullName,
      phone: data.phone,
      email: data.email || null,
      passwordHash,
      role: (data.role as any) || 'MANAGER',
      isActive: data.isActive !== undefined ? data.isActive : true,
    });

    await auditService.recordLog({
      gamingCenterId: data.gamingCenterId,
      platformAdminId: adminActor.id || (adminActor as any).actorId,
      action: 'PLATFORM_ADMIN_USER_CREATE',
      entity: 'User',
      entityId: created.id,
      newData: {
        id: created.id,
        gamingCenterId: created.gamingCenterId,
        fullName: created.fullName,
        phone: created.phone,
        email: created.email,
        role: created.role,
        isActive: created.isActive,
      },
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    const { passwordHash: _passwordHash, ...rest } = created as any; void _passwordHash;
    return rest;
  },

  async updateUser(
    userId: string,
    data: import('./platform-admin.validators').UpdatePlatformUserInput,
    adminActor: { id: string },
    context?: { ip?: string; userAgent?: string }
  ) {
    const user = await PlatformAdminRepo.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', httpStatus.NOT_FOUND);
    }

    // Check phone uniqueness if phone is updated
    if (data.phone && data.phone !== user.phone) {
      const existingPhone = await (prisma as any).user.findFirst({
        where: {
          gamingCenterId: user.gamingCenterId,
          phone: data.phone,
          id: { not: userId },
        },
      });
      if (existingPhone) {
        throw new AppError('A user with this phone number already exists in this gaming center', httpStatus.CONFLICT);
      }
    }

    // Check email uniqueness if email is updated
    if (data.email && data.email !== user.email) {
      const existingEmail = await (prisma as any).user.findFirst({
        where: {
          gamingCenterId: user.gamingCenterId,
          email: data.email,
          id: { not: userId },
        },
      });
      if (existingEmail) {
        throw new AppError('A user with this email already exists in this gaming center', httpStatus.CONFLICT);
      }
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const currentParts = (user.fullName || '').trim().split(' ');
      const newFirst = data.firstName !== undefined ? data.firstName.trim() : (currentParts[0] || '');
      const newLast = data.lastName !== undefined ? data.lastName.trim() : (currentParts.slice(1).join(' ') || '');
      updateData.fullName = `${newFirst} ${newLast}`.trim();
    }
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.publicName !== undefined) updateData.publicName = data.publicName;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;

    const updated = await PlatformAdminRepo.updateUser(userId, updateData);
    await invalidateActorCache(userId, 'USER');

    await auditService.recordLog({
      gamingCenterId: user.gamingCenterId,
      platformAdminId: adminActor.id || (adminActor as any).actorId,
      action: 'PLATFORM_ADMIN_USER_UPDATE',
      entity: 'User',
      entityId: userId,
      oldData: user,
      newData: updateData,
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    const { passwordHash: _passwordHash, ...rest } = updated as any; void _passwordHash;
    return rest;
  },

  async deleteUser(
    userId: string,
    adminActor: { id: string },
    context?: { ip?: string; userAgent?: string }
  ) {
    const user = await PlatformAdminRepo.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', httpStatus.NOT_FOUND);
    }

    // Check financial & operational dependencies
    const dependencyCount = await PlatformAdminRepo.countUserFinancialDependencies(userId);
    if (dependencyCount > 0) {
      // Soft-delete to preserve financial audit trail
      await PlatformAdminRepo.updateUser(userId, { isActive: false });
      await PlatformAdminRepo.revokeUserSessions(userId);
      await invalidateActorCache(userId, 'USER');

      await auditService.recordLog({
        gamingCenterId: user.gamingCenterId,
        platformAdminId: adminActor.id || (adminActor as any).actorId,
        action: 'PLATFORM_ADMIN_USER_SOFT_DELETE',
        entity: 'User',
        entityId: userId,
        oldData: { isActive: user.isActive },
        newData: { isActive: false, reason: 'Deactivated due to existing financial dependencies' },
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
      });

      return {
        message: 'User has related reservations or transactions; user was safely deactivated (soft-deleted).',
        deactivated: true,
      };
    } else {
      // Hard delete if clean
      await PlatformAdminRepo.revokeUserSessions(userId);
      await PlatformAdminRepo.deleteUser(userId);
      await invalidateActorCache(userId, 'USER');

      await auditService.recordLog({
        gamingCenterId: user.gamingCenterId,
        platformAdminId: adminActor.id || (adminActor as any).actorId,
        action: 'PLATFORM_ADMIN_USER_DELETE',
        entity: 'User',
        entityId: userId,
        oldData: user,
        newData: { deleted: true },
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
      });

      return {
        message: 'User deleted successfully.',
        deleted: true,
      };
    }
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
};
