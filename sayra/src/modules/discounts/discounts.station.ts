import { Discount, DiscountCampaign, DiscountFundingSource, DiscountTargetType, DiscountValueType, Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import AppError from '../../common/errors/AppError';
import { DiscountsRepo } from './discounts.repo';
import { ReservationRepo } from '../reservation/reservation.repo';
import { auditService } from '../audit/audit.station';
import { RequestActor } from '../../types/express';
import {
  CreateCampaignInput,
  CreateDiscountInput,
  ListDiscountQuery,
  UpdateCampaignInput,
  UpdateDiscountInput,
  UpdateDiscountStatusInput,
} from './discounts.dto';

const validateTarget = async (
  gamingCenterId: string,
  targetType: DiscountTargetType,
  targetId: string,
  tx?: Prisma.TransactionClient
) => {
  if (targetType === DiscountTargetType.GAMING_CENTER) {
    if (targetId !== gamingCenterId) {
      throw new AppError('Gaming Center targetId must match tenant gamingCenterId.', httpStatus.BAD_REQUEST, {
        code: 'INVALID_TARGET_ID',
      });
    }
    const gamingCenter = await ReservationRepo.findGamingCenterWithSettings(gamingCenterId, tx);
    if (!gamingCenter) {
      throw new AppError('Referenced Gaming Center not found.', httpStatus.NOT_FOUND);
    }
  } else if (targetType === DiscountTargetType.STATION) {
    const station = await ReservationRepo.findStation(targetId, gamingCenterId, undefined, tx);
    if (!station) {
      throw new AppError('Referenced GameStation not found or does not belong to this Gaming Center.', httpStatus.NOT_FOUND);
    }
  } else {
    throw new AppError('Invalid discount target type.', httpStatus.BAD_REQUEST);
  }
};

export const calculateDiscountAmount = (
  basePrice: number,
  valueType: DiscountValueType,
  value: number
): number => {
  if (basePrice <= 0 || value <= 0) {
    return 0;
  }
  let calculated = 0;
  if (valueType === DiscountValueType.PERCENTAGE) {
    calculated = (basePrice * value) / 100;
  } else if (valueType === DiscountValueType.FIXED_AMOUNT) {
    calculated = value;
  }
  return Math.min(basePrice, Math.max(0, Math.round(calculated * 100) / 100));
};

export const calculateCampaignDiscountAmount = (
  basePrice: number,
  valueType: DiscountValueType,
  value: number,
  maxDiscountAmount?: number | null
): number => {
  if (basePrice <= 0 || value <= 0) return 0;
  let calculated = 0;
  if (valueType === DiscountValueType.PERCENTAGE) {
    calculated = (basePrice * value) / 100;
    if (maxDiscountAmount !== undefined && maxDiscountAmount !== null && maxDiscountAmount > 0) {
      calculated = Math.min(calculated, maxDiscountAmount);
    }
  } else if (valueType === DiscountValueType.FIXED_AMOUNT) {
    calculated = value;
  }
  return Math.min(basePrice, Math.max(0, Math.round(calculated * 100) / 100));
};

export const validateCampaignForReservation = async (
  campaign: DiscountCampaign,
  stationId: string,
  basePrice: number,
  customerAccountId?: string,
  atTime: Date = new Date(),
  tx?: Prisma.TransactionClient
): Promise<{ discountAmount: number; isValid: boolean; reason?: string }> => {
  if (!campaign.isActive) {
    return { discountAmount: 0, isValid: false, reason: 'Campaign is inactive.' };
  }

  if (atTime < campaign.startAt || atTime > campaign.endAt) {
    return { discountAmount: 0, isValid: false, reason: 'Campaign is expired or not yet started.' };
  }

  if (campaign.targetType === DiscountTargetType.STATION && campaign.targetId && campaign.targetId !== stationId) {
    return { discountAmount: 0, isValid: false, reason: 'Campaign is not valid for this station.' };
  }

  if (campaign.minReservationAmount && basePrice < campaign.minReservationAmount) {
    return {
      discountAmount: 0,
      isValid: false,
      reason: `Reservation amount must be at least ${campaign.minReservationAmount}.`,
    };
  }

  if (campaign.maxUsageCount !== null && campaign.maxUsageCount !== undefined && campaign.currentUsageCount >= campaign.maxUsageCount) {
    return { discountAmount: 0, isValid: false, reason: 'Campaign maximum usage limit reached.' };
  }

  const calculatedDiscount = calculateCampaignDiscountAmount(
    basePrice,
    campaign.valueType,
    campaign.value,
    campaign.maxDiscountAmount
  );

  if (calculatedDiscount <= 0) {
    return { discountAmount: 0, isValid: false, reason: 'Calculated discount is zero.' };
  }

  if (campaign.totalBudget !== null && campaign.totalBudget !== undefined) {
    const remainingBudget = campaign.totalBudget - campaign.usedBudget;
    if (remainingBudget < calculatedDiscount) {
      return { discountAmount: 0, isValid: false, reason: 'Campaign remaining budget is insufficient.' };
    }
  }

  if (customerAccountId && campaign.maxUsagePerUser) {
    const usageCount = await DiscountsRepo.countUserCampaignUsages(campaign.id, customerAccountId, tx);
    if (usageCount >= campaign.maxUsagePerUser) {
      return { discountAmount: 0, isValid: false, reason: 'User usage limit reached for this campaign.' };
    }
  }

  return { discountAmount: calculatedDiscount, isValid: true };
};

export const selectBestDiscount = (
  discounts: Discount[],
  basePrice: number
): { applicableDiscount: Discount | null; discountAmount: number } => {
  if (!discounts || discounts.length === 0 || basePrice <= 0) {
    return { applicableDiscount: null, discountAmount: 0 };
  }

  // Target Precedence: STATION > GAMING_CENTER
  const stationDiscounts = discounts.filter((d) => d.targetType === DiscountTargetType.STATION);
  const candidateDiscounts = stationDiscounts.length > 0
    ? stationDiscounts
    : discounts.filter((d) => d.targetType === DiscountTargetType.GAMING_CENTER);

  let bestDiscount: Discount | null = null;
  let maxDiscountAmount = -1;

  for (const discount of candidateDiscounts) {
    const amount = calculateDiscountAmount(basePrice, discount.valueType, discount.value);
    if (amount > maxDiscountAmount) {
      maxDiscountAmount = amount;
      bestDiscount = discount;
    }
  }

  if (!bestDiscount || maxDiscountAmount <= 0) {
    return { applicableDiscount: null, discountAmount: 0 };
  }

  return { applicableDiscount: bestDiscount, discountAmount: maxDiscountAmount };
};

export const discountsStation = {
  async createDiscount(
    gamingCenterId: string,
    createdByUserId: string,
    input: CreateDiscountInput,
    actor?: RequestActor,
    context?: { ip?: string; userAgent?: string }
  ) {
    await validateTarget(gamingCenterId, input.targetType, input.targetId);

    const discount = await DiscountsRepo.createDiscount({
      gamingCenterId,
      targetType: input.targetType,
      targetId: input.targetId,
      valueType: input.valueType,
      value: input.value,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      isActive: input.isActive ?? true,
      createdByUserId,
    });

    if (actor) {
      await auditService.log(
        gamingCenterId,
        actor,
        'DISCOUNT_CREATE',
        { name: 'Discount', id: discount.id },
        { new: discount },
        context
      );
    }

    return discount;
  },

  async getDiscountById(id: string, gamingCenterId: string) {
    const discount = await DiscountsRepo.findById(id, gamingCenterId);
    if (!discount) {
      throw new AppError('Discount not found.', httpStatus.NOT_FOUND);
    }
    return discount;
  },

  async listDiscounts(gamingCenterId: string, query: ListDiscountQuery) {
    const { page = 1, pageSize = 20, targetType, targetId, isActive } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.DiscountWhereInput = {
      gamingCenterId,
      targetType,
      targetId,
      isActive,
    };

    const [discounts, totalItems] = await Promise.all([
      DiscountsRepo.findMany(where, skip, pageSize),
      DiscountsRepo.count(where),
    ]);

    return {
      data: discounts,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  },

  async updateDiscount(
    id: string,
    gamingCenterId: string,
    input: UpdateDiscountInput,
    actor?: RequestActor,
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await DiscountsRepo.findById(id, gamingCenterId);
    if (!existing) {
      throw new AppError('Discount not found.', httpStatus.NOT_FOUND);
    }

    const effectiveTargetType = input.targetType ?? existing.targetType;
    const effectiveTargetId = input.targetId ?? existing.targetId;
    if (input.targetType || input.targetId) {
      await validateTarget(gamingCenterId, effectiveTargetType, effectiveTargetId);
    }

    const effectiveValueType = input.valueType ?? existing.valueType;
    const effectiveValue = input.value ?? existing.value;
    if (effectiveValueType === DiscountValueType.PERCENTAGE && effectiveValue > 100) {
      throw new AppError('Percentage discount value cannot exceed 100%.', httpStatus.BAD_REQUEST);
    }

    const effectiveStartAt = input.startAt ? new Date(input.startAt) : existing.startAt;
    const effectiveEndAt = input.endAt ? new Date(input.endAt) : existing.endAt;
    if (effectiveEndAt.getTime() <= effectiveStartAt.getTime()) {
      throw new AppError('endAt must be strictly after startAt.', httpStatus.BAD_REQUEST);
    }

    const updateData: Prisma.DiscountUncheckedUpdateInput = {
      targetType: input.targetType,
      targetId: input.targetId,
      valueType: input.valueType,
      value: input.value,
      startAt: input.startAt ? new Date(input.startAt) : undefined,
      endAt: input.endAt ? new Date(input.endAt) : undefined,
      isActive: input.isActive,
    };

    const updated = await DiscountsRepo.updateDiscount(id, gamingCenterId, updateData);

    if (actor) {
      await auditService.log(
        gamingCenterId,
        actor,
        'DISCOUNT_UPDATE',
        { name: 'Discount', id },
        { old: existing, new: updated },
        context
      );
    }

    return updated;
  },

  async updateDiscountStatus(
    id: string,
    gamingCenterId: string,
    input: UpdateDiscountStatusInput,
    actor?: RequestActor,
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await DiscountsRepo.findById(id, gamingCenterId);
    if (!existing) {
      throw new AppError('Discount not found.', httpStatus.NOT_FOUND);
    }

    const updated = await DiscountsRepo.updateDiscount(id, gamingCenterId, {
      isActive: input.isActive,
    });

    if (actor) {
      await auditService.log(
        gamingCenterId,
        actor,
        'DISCOUNT_STATUS_UPDATE',
        { name: 'Discount', id },
        { old: existing, new: updated },
        context
      );
    }

    return updated;
  },

  async deleteDiscount(
    id: string,
    gamingCenterId: string,
    actor?: RequestActor,
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await DiscountsRepo.findById(id, gamingCenterId);
    if (!existing) {
      throw new AppError('Discount not found.', httpStatus.NOT_FOUND);
    }

    const deleted = await DiscountsRepo.deleteDiscount(id, gamingCenterId);

    if (actor) {
      await auditService.log(
        gamingCenterId,
        actor,
        'DISCOUNT_DELETE',
        { name: 'Discount', id },
        { old: existing },
        context
      );
    }

    return deleted;
  },

  async calculateApplicableDiscount(
    gamingCenterId: string,
    stationId: string,
    basePrice: number,
    reservationTime: Date = new Date(),
    tx?: Prisma.TransactionClient
  ): Promise<{ applicableDiscount: Discount | null; discountAmount: number }> {
    if (basePrice <= 0) {
      return { applicableDiscount: null, discountAmount: 0 };
    }

    const activeDiscounts = await DiscountsRepo.findActiveApplicableDiscounts(
      gamingCenterId,
      stationId,
      reservationTime,
      tx
    );

    return selectBestDiscount(activeDiscounts, basePrice);
  },

  async createCampaign(
    gamingCenterId: string | null,
    createdByUserId: string | null,
    input: CreateCampaignInput,
    actor?: RequestActor,
    context?: { ip?: string; userAgent?: string }
  ) {
    if (input.code) {
      const existing = await DiscountsRepo.findCampaignByCode(input.code);
      if (existing) {
        throw new AppError('Discount code already exists.', httpStatus.CONFLICT, { code: 'DUPLICATE_CODE' });
      }
    }

    const campaign = await DiscountsRepo.createCampaign({
      gamingCenterId,
      name: input.name,
      code: input.code,
      codeType: input.codeType ?? 'PROMO_CODE',
      description: input.description,
      targetType: input.targetType ?? 'GAMING_CENTER',
      targetId: input.targetId,
      valueType: input.valueType,
      value: input.value,
      maxDiscountAmount: input.maxDiscountAmount,
      minReservationAmount: input.minReservationAmount,
      fundingSource: input.fundingSource ?? DiscountFundingSource.PLATFORM,
      totalBudget: input.totalBudget,
      maxUsageCount: input.maxUsageCount,
      maxUsagePerUser: input.maxUsagePerUser ?? 1,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      isActive: input.isActive ?? true,
      createdByUserId,
    });

    if (actor && gamingCenterId) {
      await auditService.log(
        gamingCenterId,
        actor,
        'CAMPAIGN_CREATE',
        { name: 'DiscountCampaign', id: campaign.id },
        { new: campaign },
        context
      );
    }

    return campaign;
  },

  async getCampaignById(id: string, gamingCenterId?: string) {
    const campaign = await DiscountsRepo.findCampaignById(id, gamingCenterId);
    if (!campaign) {
      throw new AppError('Discount campaign not found.', httpStatus.NOT_FOUND);
    }
    return campaign;
  },

  async listCampaigns(gamingCenterId: string, query: { page?: number; pageSize?: number; isActive?: boolean }) {
    const { page = 1, pageSize = 20, isActive } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.DiscountCampaignWhereInput = {
      OR: [
        { gamingCenterId },
        { gamingCenterId: null },
      ],
      isActive,
    };

    const [campaigns, totalItems] = await Promise.all([
      DiscountsRepo.findManyCampaigns(where, skip, pageSize),
      DiscountsRepo.countCampaigns(where),
    ]);

    return {
      data: campaigns,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  },

  async updateCampaign(
    id: string,
    gamingCenterId: string,
    input: UpdateCampaignInput,
    actor?: RequestActor,
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await DiscountsRepo.findCampaignById(id, gamingCenterId);
    if (!existing) {
      throw new AppError('Discount campaign not found.', httpStatus.NOT_FOUND);
    }

    if (input.code && input.code.toLowerCase() !== existing.code?.toLowerCase()) {
      const codeCheck = await DiscountsRepo.findCampaignByCode(input.code);
      if (codeCheck) {
        throw new AppError('Discount code already exists.', httpStatus.CONFLICT, { code: 'DUPLICATE_CODE' });
      }
    }

    const updateData: Prisma.DiscountCampaignUncheckedUpdateInput = {
      name: input.name,
      code: input.code,
      codeType: input.codeType,
      description: input.description,
      targetType: input.targetType,
      targetId: input.targetId,
      valueType: input.valueType,
      value: input.value,
      maxDiscountAmount: input.maxDiscountAmount,
      minReservationAmount: input.minReservationAmount,
      fundingSource: input.fundingSource,
      totalBudget: input.totalBudget,
      maxUsageCount: input.maxUsageCount,
      maxUsagePerUser: input.maxUsagePerUser,
      startAt: input.startAt ? new Date(input.startAt) : undefined,
      endAt: input.endAt ? new Date(input.endAt) : undefined,
      isActive: input.isActive,
    };

    const updated = await DiscountsRepo.updateCampaign(id, updateData);

    if (actor) {
      await auditService.log(
        gamingCenterId,
        actor,
        'CAMPAIGN_UPDATE',
        { name: 'DiscountCampaign', id },
        { old: existing, new: updated },
        context
      );
    }

    return updated;
  },

  async validateAndApplyPromoCode(
    gamingCenterId: string,
    code: string,
    stationId: string,
    basePrice: number,
    customerAccountId?: string,
    atTime: Date = new Date(),
    forUpdate = false,
    tx?: Prisma.TransactionClient
  ): Promise<{
    campaign: DiscountCampaign;
    discountAmount: number;
    fundingSource: DiscountFundingSource;
    platformFundedDiscount: number;
    customerPayableAmount: number;
  }> {
    let campaign: DiscountCampaign | null = null;
    if (forUpdate && tx) {
      campaign = await DiscountsRepo.findCampaignByCodeForUpdate(code, gamingCenterId, tx);
    } else {
      campaign = await DiscountsRepo.findCampaignByCode(code, gamingCenterId, tx);
    }

    if (!campaign) {
      throw new AppError('Invalid or expired discount code.', httpStatus.NOT_FOUND, { code: 'INVALID_DISCOUNT_CODE' });
    }

    const validation = await validateCampaignForReservation(
      campaign,
      stationId,
      basePrice,
      customerAccountId,
      atTime,
      tx
    );

    if (!validation.isValid) {
      throw new AppError(validation.reason || 'Discount code cannot be applied.', httpStatus.BAD_REQUEST, {
        code: 'DISCOUNT_CODE_INELIGIBLE',
      });
    }

    const discountAmount = validation.discountAmount;
    const fundingSource = campaign.fundingSource;
    const platformFundedDiscount = (fundingSource === DiscountFundingSource.PLATFORM || fundingSource === DiscountFundingSource.CAMPAIGN_BUDGET)
      ? discountAmount
      : 0;
    const customerPayableAmount = Math.max(0, basePrice - discountAmount);

    return {
      campaign,
      discountAmount,
      fundingSource,
      platformFundedDiscount,
      customerPayableAmount,
    };
  },

  async consumeCampaignDiscount(
    campaignId: string,
    reservationId: string,
    customerAccountId: string,
    discountAmount: number,
    fundingSource: DiscountFundingSource,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const campaign = await DiscountsRepo.findCampaignById(campaignId, undefined, tx);
    if (!campaign) return;

    await DiscountsRepo.updateCampaign(
      campaignId,
      {
        usedBudget: campaign.usedBudget + discountAmount,
        currentUsageCount: campaign.currentUsageCount + 1,
      },
      tx
    );

    await DiscountsRepo.createDiscountUsage(
      {
        campaignId,
        reservationId,
        customerAccountId,
        discountAmount,
        fundingSource,
      },
      tx
    );
  },
};
