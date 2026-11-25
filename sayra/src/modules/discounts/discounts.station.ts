/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Discount,
  DiscountCampaign,
  DiscountFundingSource,
  DiscountTargetType,
  DiscountValueType,
  DiscountUsageStatus,
  DiscountUsage,
  Prisma,
  SessionActorType,
} from '@prisma/client';
import httpStatus from 'http-status';
import { addMinutes } from 'date-fns';
import AppError from '../../common/errors/AppError';
import { prisma } from '../../config/prisma';
import { DiscountsRepo } from './discounts.repo';
import { ReservationRepo } from '../reservation/reservation.repo';
import { auditService } from '../audit/audit.station';
import { RequestActor } from '../../types/express';
import { calculateBasePrice } from '../../common/utils/money';
import {
  resolveEffectiveCommissionPolicy,
  evaluateMonthlyTarget,
  computeCommissionAmount,
  computeMerchantPayoutAmount,
} from '../commissions/commission-calculator';
import {
  CreateCampaignInput,
  CreateDiscountInput,
  ListDiscountQuery,
  UpdateCampaignInput,
  UpdateDiscountInput,
  UpdateDiscountStatusInput,
  GetAvailableDiscountsInput,
  CalculateDiscountSelectionInput,
  ReserveDiscountInput,
  ReleaseDiscountInput,
  RedeemDiscountInput,
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
  let calculated = calculateDiscountAmount(basePrice, valueType, value);
  if (valueType === DiscountValueType.PERCENTAGE) {
    if (maxDiscountAmount !== undefined && maxDiscountAmount !== null && maxDiscountAmount > 0) {
      calculated = Math.min(calculated, maxDiscountAmount);
    }
  } else if (valueType === DiscountValueType.FIXED_AMOUNT) {
    calculated = Math.min(basePrice, value);
  }
  return Math.min(basePrice, Math.max(0, Math.round(calculated * 100) / 100));
};

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function isWithinCampaignSchedule(
  campaign: any,
  atTime: Date,
  timeZone = 'Asia/Tehran'
): { ok: boolean; reason?: string } {
  const days: number[] = Array.isArray(campaign.applicableDaysOfWeek) ? campaign.applicableDaysOfWeek : [];
  const startTime: string | null = campaign.dailyStartTime ?? null;
  const endTime: string | null = campaign.dailyEndTime ?? null;

  if (days.length === 0 && (!startTime || !endTime)) {
    return { ok: true };
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(atTime);

  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minuteStr = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const normalizedHour = hourStr === '24' ? '00' : hourStr;
  const currentHHmm = `${normalizedHour}:${minuteStr}`;
  const dayOfWeek = WEEKDAY_MAP[weekdayStr];

  if (days.length > 0 && dayOfWeek !== undefined && !days.includes(dayOfWeek)) {
    return { ok: false, reason: 'Campaign is not valid on this day of week.' };
  }

  if (startTime && endTime) {
    const inRange =
      startTime <= endTime
        ? currentHHmm >= startTime && currentHHmm <= endTime
        : currentHHmm >= startTime || currentHHmm <= endTime;
    if (!inRange) {
      return { ok: false, reason: 'Campaign is not valid at this time of day.' };
    }
  }

  return { ok: true };
}

export const validateCampaignForReservation = async (
  campaign: DiscountCampaign,
  stationId: string,
  basePrice: number,
  customerAccountId?: string,
  atTime: Date = new Date(),
  tx?: Prisma.TransactionClient,
  gamingCenterId?: string
): Promise<{ discountAmount: number; isValid: boolean; reason?: string }> => {
  if (campaign.deletedAt) {
    return { discountAmount: 0, isValid: false, reason: 'Campaign has been deleted.' };
  }

  if (campaign.status === 'INACTIVE' || !campaign.isActive) {
    return { discountAmount: 0, isValid: false, reason: 'Campaign is inactive.' };
  }

  if (campaign.status === 'EXPIRED' || atTime < campaign.startAt || atTime > campaign.endAt) {
    return { discountAmount: 0, isValid: false, reason: 'Campaign is expired or not yet started.' };
  }

  const scheduleCheck = isWithinCampaignSchedule(campaign, atTime);
  if (!scheduleCheck.ok) {
    return { discountAmount: 0, isValid: false, reason: scheduleCheck.reason };
  }

  // Check Scope (supports combining gaming centers, device types, and specific stations)
  if (Array.isArray(campaign.applicableGamecenterIds) && campaign.applicableGamecenterIds.length > 0) {
    if (gamingCenterId && !campaign.applicableGamecenterIds.includes(gamingCenterId)) {
      return { discountAmount: 0, isValid: false, reason: 'Campaign is not applicable to this gaming center.' };
    }
  }

  if (Array.isArray(campaign.applicableDeviceTypes) && campaign.applicableDeviceTypes.length > 0) {
    const station = await ReservationRepo.findStation(stationId, gamingCenterId, undefined, tx);
    if (!station || !campaign.applicableDeviceTypes.includes(station.stationType)) {
      return { discountAmount: 0, isValid: false, reason: 'Campaign is not applicable to this device type.' };
    }
  }

  if (Array.isArray(campaign.applicableStationIds) && campaign.applicableStationIds.length > 0) {
    if (!campaign.applicableStationIds.includes(stationId)) {
      return { discountAmount: 0, isValid: false, reason: 'Campaign is not valid for this station.' };
    }
  }

  if (campaign.targetType === DiscountTargetType.STATION && campaign.targetId && campaign.targetId !== stationId) {
    return { discountAmount: 0, isValid: false, reason: 'Campaign is not valid for this station.' };
  }

  const minAmount = campaign.minOrderAmount ?? campaign.minReservationAmount;
  if (minAmount && basePrice < minAmount) {
    return {
      discountAmount: 0,
      isValid: false,
      reason: `Reservation amount must be at least ${minAmount}.`,
    };
  }

  // Check Target Audience
  if (customerAccountId) {
    const db = tx ?? prisma;
    if (campaign.targetAudience === 'SPECIFIC_USERS') {
      if (campaign.specificUserIds.length > 0 && !campaign.specificUserIds.includes(customerAccountId)) {
        return { discountAmount: 0, isValid: false, reason: 'Campaign is not available for this user.' };
      }
    } else if (campaign.targetAudience === 'NEW_USERS') {
      const priorReservations = await db.reservation.count({
        where: { customerAccountId, status: { not: 'CANCELED' } },
      });
      if (priorReservations > 0) {
        return { discountAmount: 0, isValid: false, reason: 'Campaign is only available for new users.' };
      }
    } else if (campaign.targetAudience === 'LOYAL_USERS') {
      const minCompleted = campaign.minCompletedReservations ?? 1;
      const priorReservations = await db.reservation.count({
        where: { customerAccountId, status: 'COMPLETED' },
      });
      if (priorReservations < minCompleted) {
        return { discountAmount: 0, isValid: false, reason: 'Campaign is only available for loyal users.' };
      }
    }
  }

  // Usage Limits
  const totalLimit = campaign.totalUsageLimit ?? campaign.maxUsageCount;
  const currentCount = campaign.currentUsageCount;
  if (totalLimit !== null && totalLimit !== undefined && currentCount >= totalLimit) {
    return { discountAmount: 0, isValid: false, reason: 'Campaign maximum usage limit reached.' };
  }

  const effectiveValueType = campaign.discountType ?? campaign.valueType;
  const effectiveValue = campaign.discountValue ?? campaign.value;

  const calculatedDiscount = calculateCampaignDiscountAmount(
    basePrice,
    effectiveValueType,
    effectiveValue,
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

export async function calculateFinancialBreakdown(
  gamingCenterId: string,
  basePrice: number,
  discountAmount: number,
  discountFundingSource: DiscountFundingSource | null | undefined,
  tx?: Prisma.TransactionClient,
  source = 'ONLINE'
) {
  const originalAmount = basePrice;
  const effectivePolicy = await resolveEffectiveCommissionPolicy(gamingCenterId, tx);
  let platformCommission = 0;
  if (effectivePolicy && (!effectivePolicy.applyToOnlineOnly || source === 'ONLINE')) {
    const { targetReached } = await evaluateMonthlyTarget(
      gamingCenterId,
      effectivePolicy,
      new Date(),
      tx
    );
    platformCommission = computeCommissionAmount(originalAmount, effectivePolicy, targetReached);
  }

  const merchantPayoutAmount = computeMerchantPayoutAmount(
    originalAmount,
    discountAmount,
    discountFundingSource,
    platformCommission
  );

  const platformFundedDiscount =
    discountFundingSource === DiscountFundingSource.PLATFORM ||
    discountFundingSource === DiscountFundingSource.CAMPAIGN_BUDGET
      ? discountAmount
      : 0;

  const merchantFundedDiscount =
    discountFundingSource === DiscountFundingSource.MERCHANT_FUNDED
      ? discountAmount
      : 0;

  const customerPayableAmount = Math.max(0, basePrice - discountAmount);

  return {
    originalAmount,
    discountAmount,
    customerPayableAmount,
    merchantPayoutAmount,
    platformCommission,
    platformFundedDiscount,
    merchantFundedDiscount,
    discountFundingSource: discountFundingSource || null,
  };
}

export interface AvailableDiscountItem {
  id: string;
  type: 'CAMPAIGN' | 'DIRECT_DISCOUNT';
  title: string;
  description: string | null;
  code: string | null;
  discountType: DiscountValueType;
  value: number;
  discountAmount: number;
  finalPrice: number;
  fundingSource: DiscountFundingSource;
  conditions: string;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  expiresAt: string;
  isApplicable: boolean;
  ineligibilityReason: string | null;
  isBest: boolean;
  badge: string | null;
}

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
    await validateTarget(gamingCenterId, effectiveTargetType, effectiveTargetId);

    const effectiveValueType = input.valueType ?? existing.valueType;
    const effectiveValue = input.value ?? existing.value;
    if (effectiveValueType === DiscountValueType.PERCENTAGE && effectiveValue > 100) {
      throw new AppError('Percentage discount value cannot exceed 100%.', httpStatus.BAD_REQUEST);
    }

    const startAt = input.startAt ? new Date(input.startAt) : existing.startAt;
    const endAt = input.endAt ? new Date(input.endAt) : existing.endAt;
    if (endAt.getTime() <= startAt.getTime()) {
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
      tx,
      gamingCenterId
    );

    if (!validation.isValid) {
      throw new AppError(validation.reason || 'Discount code cannot be applied.', httpStatus.BAD_REQUEST, {
        code: 'DISCOUNT_CODE_INELIGIBLE',
      });
    }

    const discountAmount = validation.discountAmount;
    const fundingSource = campaign.fundingSource;
    const platformFundedDiscount =
      fundingSource === DiscountFundingSource.PLATFORM || fundingSource === DiscountFundingSource.CAMPAIGN_BUDGET
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

    // Check if there is already an existing RESERVED usage for this reservation or hold
    const existingUsage = await tx.discountUsage.findFirst({
      where: {
        campaignId,
        customerAccountId,
        reservationId,
      },
    });

    if (existingUsage) {
      if (existingUsage.status !== DiscountUsageStatus.REDEEMED) {
        await tx.discountUsage.update({
          where: { id: existingUsage.id },
          data: {
            status: DiscountUsageStatus.REDEEMED,
            redeemedAt: new Date(),
          },
        });
      }
      return;
    }

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
        status: DiscountUsageStatus.REDEEMED,
        redeemedAt: new Date(),
      },
      tx
    );
  },

  // ==========================================
  // Snapp-like Multi-Discount System Methods
  // ==========================================

  async getAvailableDiscounts(
    gamingCenterId: string,
    input: GetAvailableDiscountsInput,
    actor?: RequestActor,
    tx?: Prisma.TransactionClient
  ) {
    const atTime = input.startTime ? new Date(input.startTime) : new Date();
    const customerAccountId =
      input.customerAccountId ||
      (actor?.actorType === SessionActorType.CUSTOMER ? actor.id : undefined);

    let basePrice = input.basePrice ?? 0;
    if (basePrice <= 0 && input.stationId) {
      const station = await ReservationRepo.findStation(input.stationId, gamingCenterId, undefined, tx);
      if (station) {
        const durationHours = input.durationHours ?? (input.durationMinutes ? input.durationMinutes / 60 : 1);
        basePrice = calculateBasePrice(durationHours, station.hourlyPrice);
      }
    }

    const [rawDirectDiscounts, rawCampaigns] = await Promise.all([
      DiscountsRepo.findActiveApplicableDiscounts(gamingCenterId, input.stationId, atTime, tx),
      DiscountsRepo.findActiveApplicableCampaigns(gamingCenterId, atTime, tx),
    ]);
    const directDiscounts = Array.isArray(rawDirectDiscounts) ? rawDirectDiscounts : [];
    const campaigns = Array.isArray(rawCampaigns) ? rawCampaigns : [];

    // Include manually queried promo code if not already in campaigns list
    if (input.manualCode && input.manualCode.trim().length > 0) {
      const codeClean = input.manualCode.trim().toLowerCase();
      const alreadyPresent = campaigns.some((c) => c.code?.toLowerCase() === codeClean);
      if (!alreadyPresent) {
        const manualCampaign = await DiscountsRepo.findCampaignByCode(input.manualCode.trim(), gamingCenterId, tx);
        if (manualCampaign) {
          campaigns.push(manualCampaign);
        }
      }
    }

    const availableItems: AvailableDiscountItem[] = [];

    // Direct GameCenter & Station Discounts
    for (const d of directDiscounts) {
      const amount = calculateDiscountAmount(basePrice, d.valueType, d.value);
      const isApplicable = amount > 0;
      availableItems.push({
        id: d.id,
        type: 'DIRECT_DISCOUNT',
        title: d.targetType === DiscountTargetType.STATION ? 'تخفیف اختصاصی استیشن' : 'تخفیف مجموعه بازی',
        description: `تخفیف ${
          d.valueType === DiscountValueType.PERCENTAGE ? `${d.value}٪` : `${d.value.toLocaleString('fa-IR')} تومان`
        } به صورت خودکار`,
        code: null,
        discountType: d.valueType,
        value: d.value,
        discountAmount: amount,
        finalPrice: Math.max(0, basePrice - amount),
        fundingSource: DiscountFundingSource.MERCHANT_FUNDED,
        conditions: d.targetType === DiscountTargetType.STATION ? 'اعمال روی این دستگاه' : 'اعمال روی کل مجموعه',
        minOrderAmount: null,
        maxDiscountAmount: null,
        expiresAt: d.endAt.toISOString(),
        isApplicable,
        ineligibilityReason: isApplicable ? null : 'مبلغ تخفیف صفر است',
        isBest: false,
        badge: null,
      });
    }

    // Campaign Discounts (Platform & GameCenter)
    for (const c of campaigns) {
      const validation = await validateCampaignForReservation(
        c,
        input.stationId,
        basePrice,
        customerAccountId,
        atTime,
        tx,
        gamingCenterId
      );

      const amount = validation.isValid ? validation.discountAmount : 0;
      const effectiveType = c.discountType ?? c.valueType;
      const effectiveVal = c.discountValue ?? c.value;

      availableItems.push({
        id: c.id,
        type: 'CAMPAIGN',
        title: c.title || c.name,
        description: c.description || (c.code ? `کد تخفیف: ${c.code}` : 'کمپین تخفیف پلتفرم'),
        code: c.code || null,
        discountType: effectiveType,
        value: effectiveVal,
        discountAmount: amount,
        finalPrice: Math.max(0, basePrice - amount),
        fundingSource: c.fundingSource,
        conditions:
          [
            c.minOrderAmount ? `حداقل مبلغ: ${c.minOrderAmount.toLocaleString('fa-IR')} تومان` : null,
            c.maxDiscountAmount ? `حداکثر تخفیف: ${c.maxDiscountAmount.toLocaleString('fa-IR')} تومان` : null,
            c.scopeType === 'SPECIFIC_DEVICE_TYPES' ? 'دستگاه‌های منتخب' : null,
            c.targetAudience === 'NEW_USERS' ? 'مخصوص کاربران بار اولی' : null,
          ]
            .filter(Boolean)
            .join(' | ') || 'بدون محدودیت خاص',
        minOrderAmount: c.minOrderAmount ?? c.minReservationAmount ?? null,
        maxDiscountAmount: c.maxDiscountAmount ?? null,
        expiresAt: c.endAt.toISOString(),
        isApplicable: validation.isValid,
        ineligibilityReason: validation.isValid ? null : validation.reason || 'شرایط اعمال تخفیف احراز نشد',
        isBest: false,
        badge: null,
      });
    }

    // Identify the best discount based on actual monetary savings
    const applicableItems = availableItems.filter((i) => i.isApplicable && i.discountAmount > 0);
    applicableItems.sort((a, b) => {
      if (b.discountAmount !== a.discountAmount) {
        return b.discountAmount - a.discountAmount;
      }
      return b.value - a.value;
    });

    let recommendedDiscountId: string | null = null;
    let recommendedDiscountType: 'CAMPAIGN' | 'DIRECT_DISCOUNT' | null = null;

    if (applicableItems.length > 0) {
      const best = applicableItems[0];
      best.isBest = true;
      best.badge = 'بهترین تخفیف برای شما';
      recommendedDiscountId = best.id;
      recommendedDiscountType = best.type;
    }

    return {
      basePrice,
      recommendedDiscountId,
      recommendedDiscountType,
      discounts: availableItems,
    };
  },

  async calculateDiscountSelection(
    gamingCenterId: string,
    input: CalculateDiscountSelectionInput,
    actor?: RequestActor,
    tx?: Prisma.TransactionClient
  ) {
    const atTime = input.startTime ? new Date(input.startTime) : new Date();
    const customerAccountId =
      input.customerAccountId ||
      (actor?.actorType === SessionActorType.CUSTOMER ? actor.id : undefined);
    const basePrice = input.basePrice;

    // 1. Explicit NONE or No Discount chosen
    if (input.selectedType === 'NONE' || (!input.selectedDiscountId && !input.code)) {
      const financials = await calculateFinancialBreakdown(
        gamingCenterId,
        basePrice,
        0,
        null,
        tx
      );

      const available = await this.getAvailableDiscounts(
        gamingCenterId,
        {
          stationId: input.stationId,
          basePrice,
          startTime: input.startTime,
          customerAccountId,
        },
        actor,
        tx
      );

      const bestItem = available.discounts.find((d) => d.isBest && d.isApplicable && d.discountAmount > 0);

      return {
        isValid: true,
        ...financials,
        campaignId: null,
        discountId: null,
        voucherCode: null,
        appliedDiscount: null,
        betterDiscountAvailable: Boolean(bestItem),
        betterDiscount: bestItem
          ? {
              id: bestItem.id,
              type: bestItem.type,
              title: bestItem.title,
              discountAmount: bestItem.discountAmount,
              savingsDifference: bestItem.discountAmount,
            }
          : null,
      };
    }

    let appliedDiscount: any = null;
    let discountAmount = 0;
    let fundingSource: DiscountFundingSource = DiscountFundingSource.PLATFORM;
    let campaignId: string | null = null;
    let discountId: string | null = null;
    let voucherCode: string | null = null;

    // 2. Campaign Discount (by ID or Code)
    if (input.code || input.selectedType === 'CAMPAIGN') {
      let campaign: DiscountCampaign | null = null;
      if (input.code) {
        campaign = await DiscountsRepo.findCampaignByCode(input.code.trim(), gamingCenterId, tx);
      } else if (input.selectedDiscountId) {
        campaign = await DiscountsRepo.findCampaignById(input.selectedDiscountId, gamingCenterId, tx);
      }

      if (!campaign) {
        throw new AppError('کد تخفیف یا کمپین نامعتبر است یا منقضی شده است.', httpStatus.NOT_FOUND, {
          code: 'INVALID_DISCOUNT_CODE',
        });
      }

      const validation = await validateCampaignForReservation(
        campaign,
        input.stationId,
        basePrice,
        customerAccountId,
        atTime,
        tx,
        gamingCenterId
      );

      if (!validation.isValid) {
        throw new AppError(validation.reason || 'این کد تخفیف برای رزرو فعلی قابل استفاده نیست.', httpStatus.BAD_REQUEST, {
          code: 'DISCOUNT_CODE_INELIGIBLE',
        });
      }

      discountAmount = validation.discountAmount;
      fundingSource = campaign.fundingSource;
      campaignId = campaign.id;
      voucherCode = campaign.code || null;
      appliedDiscount = {
        id: campaign.id,
        type: 'CAMPAIGN',
        title: campaign.title || campaign.name,
        code: campaign.code,
        discountType: campaign.discountType ?? campaign.valueType,
        value: campaign.discountValue ?? campaign.value,
        discountAmount,
        fundingSource,
      };
    } else if (input.selectedType === 'DIRECT_DISCOUNT' && input.selectedDiscountId) {
      // 3. Direct Discount
      const direct = await DiscountsRepo.findById(input.selectedDiscountId, gamingCenterId, tx);
      if (!direct || !direct.isActive || direct.startAt > atTime || direct.endAt < atTime) {
        throw new AppError('تخفیف انتخاب شده منقضی شده یا غیرفعال است.', httpStatus.NOT_FOUND, {
          code: 'DISCOUNT_NOT_FOUND',
        });
      }

      if (direct.targetType === DiscountTargetType.STATION && direct.targetId !== input.stationId) {
        throw new AppError('این تخفیف فقط برای دستگاه مشخص شده معتبر است.', httpStatus.BAD_REQUEST, {
          code: 'DISCOUNT_TARGET_MISMATCH',
        });
      }

      discountAmount = calculateDiscountAmount(basePrice, direct.valueType, direct.value);
      fundingSource = DiscountFundingSource.MERCHANT_FUNDED;
      discountId = direct.id;
      appliedDiscount = {
        id: direct.id,
        type: 'DIRECT_DISCOUNT',
        title: direct.targetType === DiscountTargetType.STATION ? 'تخفیف اختصاصی استیشن' : 'تخفیف مجموعه بازی',
        code: null,
        discountType: direct.valueType,
        value: direct.value,
        discountAmount,
        fundingSource,
      };
    }

    const financials = await calculateFinancialBreakdown(
      gamingCenterId,
      basePrice,
      discountAmount,
      fundingSource,
      tx
    );

    const available = await this.getAvailableDiscounts(
      gamingCenterId,
      {
        stationId: input.stationId,
        basePrice,
        startTime: input.startTime,
        customerAccountId,
      },
      actor,
      tx
    );

    const bestItem = available.discounts.find((d) => d.isBest && d.isApplicable && d.id !== appliedDiscount?.id);
    const betterDiscountAvailable = Boolean(bestItem && bestItem.discountAmount > discountAmount);

    return {
      isValid: true,
      ...financials,
      campaignId,
      discountId,
      voucherCode,
      appliedDiscount,
      betterDiscountAvailable,
      betterDiscount: betterDiscountAvailable && bestItem
        ? {
            id: bestItem.id,
            type: bestItem.type,
            title: bestItem.title,
            discountAmount: bestItem.discountAmount,
            savingsDifference: bestItem.discountAmount - discountAmount,
          }
        : null,
    };
  },

  async reserveDiscount(
    gamingCenterId: string,
    input: ReserveDiscountInput,
    actor?: RequestActor,
    tx?: Prisma.TransactionClient
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      // 1. Idempotency Check
      if (input.idempotencyKey) {
        const existingUsage = await DiscountsRepo.findUsageByIdempotencyKey(input.idempotencyKey, t);
        if (
          existingUsage &&
          existingUsage.status === DiscountUsageStatus.RESERVED &&
          (!existingUsage.expiresAt || existingUsage.expiresAt > new Date())
        ) {
          return existingUsage;
        }
      }

      // 2. Validate and calculate selection
      const calculation = await this.calculateDiscountSelection(
        gamingCenterId,
        {
          stationId: input.stationId,
          basePrice: input.basePrice,
          startTime: input.startTime,
          customerAccountId: input.customerAccountId,
          selectedDiscountId: input.selectedDiscountId,
          selectedType: input.selectedType,
          code: input.code,
        },
        actor,
        t
      );

      if (!calculation.appliedDiscount || calculation.discountAmount <= 0) {
        throw new AppError('هیچ تخفیف معتبری برای رزرو انتخاب نشده است.', httpStatus.BAD_REQUEST, {
          code: 'NO_VALID_DISCOUNT_SELECTED',
        });
      }

      const ttlMinutes = input.ttlMinutes ?? 15;
      const expiresAt = addMinutes(new Date(), ttlMinutes);

      // 3. If campaign, lock and atomically reserve budget and usage count
      if (calculation.campaignId) {
        const lockedCampaign = await DiscountsRepo.lockCampaignForUpdate(calculation.campaignId, t);
        if (!lockedCampaign) {
          throw new AppError('کمپین تخفیف یافت نشد.', httpStatus.NOT_FOUND);
        }

        const totalLimit = lockedCampaign.totalUsageLimit ?? lockedCampaign.maxUsageCount;
        if (totalLimit !== null && totalLimit !== undefined && lockedCampaign.currentUsageCount >= totalLimit) {
          throw new AppError('سقف استفاده از این کمپین تکمیل شده است.', httpStatus.CONFLICT, {
            code: 'CAMPAIGN_LIMIT_EXCEEDED',
          });
        }

        if (lockedCampaign.totalBudget !== null && lockedCampaign.totalBudget !== undefined) {
          const remainingBudget = lockedCampaign.totalBudget - lockedCampaign.usedBudget;
          if (remainingBudget < calculation.discountAmount) {
            throw new AppError('بودجه کمپین تخفیف به پایان رسیده است.', httpStatus.CONFLICT, {
              code: 'CAMPAIGN_BUDGET_EXCEEDED',
            });
          }
        }

        await DiscountsRepo.updateCampaign(
          lockedCampaign.id,
          {
            usedBudget: lockedCampaign.usedBudget + calculation.discountAmount,
            currentUsageCount: lockedCampaign.currentUsageCount + 1,
          },
          t
        );
      }

      // 4. Create DiscountUsage in RESERVED status
      const usage = await DiscountsRepo.createDiscountUsage(
        {
          campaignId: calculation.campaignId,
          discountId: calculation.discountId,
          reservationId: input.reservationId || null,
          bookingHoldId: input.bookingHoldId || null,
          customerAccountId: input.customerAccountId,
          discountAmount: calculation.discountAmount,
          originalPrice: calculation.originalAmount,
          finalPrice: calculation.customerPayableAmount,
          fundingSource: calculation.fundingSource || DiscountFundingSource.PLATFORM,
          status: DiscountUsageStatus.RESERVED,
          reservedAt: new Date(),
          expiresAt,
          idempotencyKey: input.idempotencyKey || null,
          voucherCode: calculation.voucherCode,
        },
        t
      );

      return usage;
    };

    return tx ? execute(tx) : DiscountsRepo.transaction(execute);
  },

  async redeemDiscount(
    reservationId: string,
    options?: { usageId?: string; bookingHoldId?: string },
    tx?: Prisma.TransactionClient
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      let usage: DiscountUsage | null = null;
      if (options?.usageId) {
        usage = await DiscountsRepo.findUsageById(options.usageId, t);
      } else if (reservationId) {
        usage = await DiscountsRepo.findActiveUsageForReservation(reservationId, t);
      } else if (options?.bookingHoldId) {
        usage = await DiscountsRepo.findActiveUsageForHold(options.bookingHoldId, t);
      }

      if (!usage) return null;

      if (usage.status === DiscountUsageStatus.REDEEMED) {
        return usage;
      }

      const updated = await DiscountsRepo.updateDiscountUsage(
        usage.id,
        {
          status: DiscountUsageStatus.REDEEMED,
          redeemedAt: new Date(),
          reservationId: reservationId || usage.reservationId,
        },
        t
      );

      return updated;
    };

    return tx ? execute(tx) : DiscountsRepo.transaction(execute);
  },

  async releaseDiscount(
    options: { usageId?: string; reservationId?: string; bookingHoldId?: string; reason?: string },
    tx?: Prisma.TransactionClient
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      let usage: DiscountUsage | null = null;
      if (options.usageId) {
        usage = await DiscountsRepo.findUsageById(options.usageId, t);
      } else if (options.reservationId) {
        usage = await DiscountsRepo.findActiveUsageForReservation(options.reservationId, t);
      } else if (options.bookingHoldId) {
        usage = await DiscountsRepo.findActiveUsageForHold(options.bookingHoldId, t);
      }

      if (!usage) return null;

      if (usage.status === DiscountUsageStatus.RELEASED || usage.status === DiscountUsageStatus.EXPIRED) {
        return usage;
      }

      if (usage.campaignId) {
        const campaign = await DiscountsRepo.lockCampaignForUpdate(usage.campaignId, t);
        if (campaign) {
          await DiscountsRepo.updateCampaign(
            campaign.id,
            {
              usedBudget: Math.max(0, campaign.usedBudget - usage.discountAmount),
              currentUsageCount: Math.max(0, campaign.currentUsageCount - 1),
            },
            t
          );
        }
      }

      const updated = await DiscountsRepo.updateDiscountUsage(
        usage.id,
        {
          status: DiscountUsageStatus.RELEASED,
          releasedAt: new Date(),
          releaseReason: options.reason || 'Reservation canceled, expired, or payment failed',
        },
        t
      );

      return updated;
    };

    return tx ? execute(tx) : DiscountsRepo.transaction(execute);
  },

  async reapExpiredDiscountHolds(now: Date = new Date(), tx?: Prisma.TransactionClient) {
    const execute = async (t: Prisma.TransactionClient) => {
      const expiredUsages = await DiscountsRepo.findExpiredReservedUsages(now, t);
      const reaped = [];
      for (const u of expiredUsages) {
        const released = await this.releaseDiscount(
          { usageId: u.id, reason: 'HOLD_EXPIRED' },
          t
        );
        if (released) {
          reaped.push(released);
        }
      }
      return reaped;
    };

    return tx ? execute(tx) : DiscountsRepo.transaction(execute);
  },

  async releaseDiscountForReservation(
    reservationId: string,
    reason?: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.releaseDiscount({ reservationId, reason }, tx);
  },

  async releaseDiscountForBookingHold(
    bookingHoldId: string,
    reason?: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.releaseDiscount({ bookingHoldId, reason }, tx);
  },
};
