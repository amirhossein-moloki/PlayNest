/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import {
  CreatePlatformCampaignInput,
  ListPlatformCampaignsQuery,
  UpdatePlatformCampaignInput,
} from './campaigns.validators';
import { auditService } from '../audit/audit.station';
import { RequestActor } from '../../types/express';

export const PlatformCampaignsRepo = {
  async listCampaigns(query: ListPlatformCampaignsQuery) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      discountType,
      scopeType,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.DiscountCampaignWhereInput = {
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }
    if (discountType) {
      where.OR = [
        { discountType },
        { valueType: discountType },
      ];
    }
    if (scopeType) {
      where.scopeType = scopeType;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (startDate) {
      where.startAt = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.endAt = { lte: new Date(endDate) };
    }

    let orderBy: Prisma.DiscountCampaignOrderByWithRelationInput = { createdAt: sortOrder };
    if (sortBy === 'startDate') {
      orderBy = { startAt: sortOrder };
    } else if (sortBy === 'usedCount') {
      orderBy = { currentUsageCount: sortOrder };
    }

    const [items, total] = await Promise.all([
      (prisma as any).discountCampaign.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      (prisma as any).discountCampaign.count({ where }),
    ]);

    const mappedItems = items.map((c: any) => ({
      id: c.id,
      title: c.title || c.name,
      code: c.code,
      description: c.description,
      discountType: c.discountType || c.valueType,
      discountValue: c.discountValue ?? c.value,
      maxDiscountAmount: c.maxDiscountAmount,
      minOrderAmount: c.minOrderAmount ?? c.minReservationAmount,
      scopeType: c.scopeType || 'GLOBAL',
      applicableGamecenterIds: c.applicableGamecenterIds || [],
      applicableDeviceTypes: c.applicableDeviceTypes || [],
      targetAudience: c.targetAudience || 'ALL_USERS',
      specificUserIds: c.specificUserIds || [],
      totalUsageLimit: c.totalUsageLimit ?? c.maxUsageCount,
      perUserUsageLimit: c.perUserUsageLimit ?? c.maxUsagePerUser,
      usedCount: c.currentUsageCount,
      startDate: c.startAt,
      endDate: c.endAt,
      status: c.status || (c.isActive ? 'ACTIVE' : 'INACTIVE'),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      createdBy: c.createdByUserId,
    }));

    return {
      items: mappedItems,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findById(id: string) {
    return (prisma as any).discountCampaign.findFirst({
      where: { id, deletedAt: null },
    });
  },

  async findByCode(code: string) {
    return (prisma as any).discountCampaign.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
        deletedAt: null,
      },
    });
  },

  async createCampaign(data: Prisma.DiscountCampaignUncheckedCreateInput) {
    return (prisma as any).discountCampaign.create({
      data,
    });
  },

  async updateCampaign(id: string, data: Prisma.DiscountCampaignUncheckedUpdateInput) {
    return (prisma as any).discountCampaign.update({
      where: { id },
      data,
    });
  },

  async countUsages(campaignId: string) {
    return (prisma as any).discountUsage.count({
      where: { campaignId },
    });
  },
};

export const PlatformCampaignsStation = {
  async listCampaigns(query: ListPlatformCampaignsQuery) {
    return PlatformCampaignsRepo.listCampaigns(query);
  },

  async createCampaign(
    input: CreatePlatformCampaignInput,
    actor?: RequestActor,
    context?: { ip?: string; userAgent?: string }
  ) {
    // 1. Unique code check
    const existing = await PlatformCampaignsRepo.findByCode(input.code);
    if (existing) {
      throw new AppError('Discount code must be unique.', httpStatus.CONFLICT);
    }

    // 2. Validate SPECIFIC_GAMECENTERS exist
    if (input.scopeType === 'SPECIFIC_GAMECENTERS' && input.applicableGamecenterIds?.length) {
      const count = await (prisma as any).gamingCenter.count({
        where: { id: { in: input.applicableGamecenterIds } },
      });
      if (count !== input.applicableGamecenterIds.length) {
        throw new AppError('One or more selected gaming centers do not exist.', httpStatus.BAD_REQUEST);
      }
    }

    // 3. Validate SPECIFIC_USERS exist
    if (input.targetAudience === 'SPECIFIC_USERS' && input.specificUserIds?.length) {
      const count = await (prisma as any).customerAccount.count({
        where: { id: { in: input.specificUserIds } },
      });
      if (count !== input.specificUserIds.length) {
        throw new AppError('One or more selected users do not exist.', httpStatus.BAD_REQUEST);
      }
    }

    const campaign = await PlatformCampaignsRepo.createCampaign({
      title: input.title,
      name: input.title,
      code: input.code,
      description: input.description,
      discountType: input.discountType,
      valueType: input.discountType,
      discountValue: input.discountValue,
      value: input.discountValue,
      maxDiscountAmount: input.maxDiscountAmount,
      minOrderAmount: input.minOrderAmount ?? 0,
      minReservationAmount: input.minOrderAmount ?? 0,
      scopeType: input.scopeType,
      applicableGamecenterIds: input.applicableGamecenterIds,
      applicableDeviceTypes: input.applicableDeviceTypes,
      targetAudience: input.targetAudience,
      specificUserIds: input.specificUserIds,
      totalUsageLimit: input.totalUsageLimit,
      maxUsageCount: input.totalUsageLimit,
      perUserUsageLimit: input.perUserUsageLimit,
      maxUsagePerUser: input.perUserUsageLimit ?? 1,
      startAt: new Date(input.startDate),
      endAt: new Date(input.endDate),
      status: input.status,
      isActive: input.status === 'ACTIVE',
      createdByUserId: actor?.id || (actor as any)?.actorId,
    });

    if (actor) {
      await auditService.recordLog({
        platformAdminId: actor.id || (actor as any).actorId,
        action: 'PLATFORM_CAMPAIGN_CREATE',
        entity: 'DiscountCampaign',
        entityId: campaign.id,
        newData: campaign,
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
      });
    }

    return {
      id: campaign.id,
      title: campaign.title || campaign.name,
      code: campaign.code,
      description: campaign.description,
      discountType: campaign.discountType || campaign.valueType,
      discountValue: campaign.discountValue ?? campaign.value,
      maxDiscountAmount: campaign.maxDiscountAmount,
      minOrderAmount: campaign.minOrderAmount ?? campaign.minReservationAmount,
      scopeType: campaign.scopeType || 'GLOBAL',
      applicableGamecenterIds: campaign.applicableGamecenterIds || [],
      applicableDeviceTypes: campaign.applicableDeviceTypes || [],
      targetAudience: campaign.targetAudience || 'ALL_USERS',
      specificUserIds: campaign.specificUserIds || [],
      totalUsageLimit: campaign.totalUsageLimit ?? campaign.maxUsageCount,
      perUserUsageLimit: campaign.perUserUsageLimit ?? campaign.maxUsagePerUser,
      usedCount: campaign.currentUsageCount,
      startDate: campaign.startAt,
      endDate: campaign.endAt,
      status: campaign.status || (campaign.isActive ? 'ACTIVE' : 'INACTIVE'),
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      createdBy: campaign.createdByUserId,
    };
  },

  async updateCampaign(
    id: string,
    input: UpdatePlatformCampaignInput,
    actor?: RequestActor,
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await PlatformCampaignsRepo.findById(id);
    if (!existing) {
      throw new AppError('Campaign not found.', httpStatus.NOT_FOUND);
    }

    // Check code uniqueness
    if (input.code && input.code.toLowerCase() !== existing.code?.toLowerCase()) {
      const codeCheck = await PlatformCampaignsRepo.findByCode(input.code);
      if (codeCheck && codeCheck.id !== id) {
        throw new AppError('Discount code already exists.', httpStatus.CONFLICT);
      }
    }

    // Check if campaign was used, prevent breaking changes
    if (existing.currentUsageCount > 0) {
      if (input.discountType && input.discountType !== existing.discountType && input.discountType !== existing.valueType) {
        throw new AppError('Cannot change discount type for campaigns that have already been used.', httpStatus.BAD_REQUEST);
      }
    }

    // Validate scope if updated
    if (input.scopeType === 'SPECIFIC_GAMECENTERS' && input.applicableGamecenterIds?.length) {
      const count = await (prisma as any).gamingCenter.count({
        where: { id: { in: input.applicableGamecenterIds } },
      });
      if (count !== input.applicableGamecenterIds.length) {
        throw new AppError('One or more selected gaming centers do not exist.', httpStatus.BAD_REQUEST);
      }
    }

    // Validate specific users if updated
    if (input.targetAudience === 'SPECIFIC_USERS' && input.specificUserIds?.length) {
      const count = await (prisma as any).customerAccount.count({
        where: { id: { in: input.specificUserIds } },
      });
      if (count !== input.specificUserIds.length) {
        throw new AppError('One or more selected users do not exist.', httpStatus.BAD_REQUEST);
      }
    }

    const updateData: Prisma.DiscountCampaignUncheckedUpdateInput = {};
    if (input.title !== undefined) {
      updateData.title = input.title;
      updateData.name = input.title;
    }
    if (input.code !== undefined) updateData.code = input.code;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.discountType !== undefined) {
      updateData.discountType = input.discountType;
      updateData.valueType = input.discountType;
    }
    if (input.discountValue !== undefined) {
      updateData.discountValue = input.discountValue;
      updateData.value = input.discountValue;
    }
    if (input.maxDiscountAmount !== undefined) updateData.maxDiscountAmount = input.maxDiscountAmount;
    if (input.minOrderAmount !== undefined) {
      updateData.minOrderAmount = input.minOrderAmount;
      updateData.minReservationAmount = input.minOrderAmount;
    }
    if (input.scopeType !== undefined) updateData.scopeType = input.scopeType;
    if (input.applicableGamecenterIds !== undefined) updateData.applicableGamecenterIds = input.applicableGamecenterIds;
    if (input.applicableDeviceTypes !== undefined) updateData.applicableDeviceTypes = input.applicableDeviceTypes;
    if (input.targetAudience !== undefined) updateData.targetAudience = input.targetAudience;
    if (input.specificUserIds !== undefined) updateData.specificUserIds = input.specificUserIds;
    if (input.totalUsageLimit !== undefined) {
      updateData.totalUsageLimit = input.totalUsageLimit;
      updateData.maxUsageCount = input.totalUsageLimit;
    }
    if (input.perUserUsageLimit !== undefined) {
      updateData.perUserUsageLimit = input.perUserUsageLimit;
      updateData.maxUsagePerUser = input.perUserUsageLimit;
    }
    if (input.startDate !== undefined) updateData.startAt = new Date(input.startDate);
    if (input.endDate !== undefined) updateData.endAt = new Date(input.endDate);
    if (input.status !== undefined) {
      updateData.status = input.status;
      updateData.isActive = input.status === 'ACTIVE';
    }

    const updated = await PlatformCampaignsRepo.updateCampaign(id, updateData);

    if (actor) {
      await auditService.recordLog({
        platformAdminId: actor.id || (actor as any).actorId,
        action: 'PLATFORM_CAMPAIGN_UPDATE',
        entity: 'DiscountCampaign',
        entityId: id,
        oldData: existing,
        newData: updated,
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
      });
    }

    return {
      id: updated.id,
      title: updated.title || updated.name,
      code: updated.code,
      description: updated.description,
      discountType: updated.discountType || updated.valueType,
      discountValue: updated.discountValue ?? updated.value,
      maxDiscountAmount: updated.maxDiscountAmount,
      minOrderAmount: updated.minOrderAmount ?? updated.minReservationAmount,
      scopeType: updated.scopeType || 'GLOBAL',
      applicableGamecenterIds: updated.applicableGamecenterIds || [],
      applicableDeviceTypes: updated.applicableDeviceTypes || [],
      targetAudience: updated.targetAudience || 'ALL_USERS',
      specificUserIds: updated.specificUserIds || [],
      totalUsageLimit: updated.totalUsageLimit ?? updated.maxUsageCount,
      perUserUsageLimit: updated.perUserUsageLimit ?? updated.maxUsagePerUser,
      usedCount: updated.currentUsageCount,
      startDate: updated.startAt,
      endDate: updated.endAt,
      status: updated.status || (updated.isActive ? 'ACTIVE' : 'INACTIVE'),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      createdBy: updated.createdByUserId,
    };
  },

  async deleteCampaign(
    id: string,
    actor?: RequestActor,
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await PlatformCampaignsRepo.findById(id);
    if (!existing) {
      throw new AppError('Campaign not found.', httpStatus.NOT_FOUND);
    }

    const usagesCount = await PlatformCampaignsRepo.countUsages(id);
    if (usagesCount > 0 || existing.currentUsageCount > 0) {
      // Soft delete / deactivate
      await PlatformCampaignsRepo.updateCampaign(id, {
        deletedAt: new Date(),
        isActive: false,
        status: 'INACTIVE',
      });
    } else {
      // No usages - safe to soft delete
      await PlatformCampaignsRepo.updateCampaign(id, {
        deletedAt: new Date(),
        isActive: false,
        status: 'INACTIVE',
      });
    }

    if (actor) {
      await auditService.recordLog({
        platformAdminId: actor.id || (actor as any).actorId,
        action: 'PLATFORM_CAMPAIGN_DELETE',
        entity: 'DiscountCampaign',
        entityId: id,
        oldData: existing,
        newData: { deleted: true },
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
      });
    }

    return { message: 'Campaign deleted successfully.' };
  },
};
