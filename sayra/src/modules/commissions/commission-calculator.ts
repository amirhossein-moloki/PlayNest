import { CommissionType, DiscountFundingSource, Prisma } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { CommissionsRepo } from './commissions.repo';

export function getTargetPeriod(date: Date, timeZone?: string | null): string {
  if (timeZone) {
    try {
      return formatInTimeZone(date, timeZone, 'yyyy-MM');
    } catch {
      // Fallback to UTC if timezone is invalid
    }
  }
  return formatInTimeZone(date, 'UTC', 'yyyy-MM');
}

export interface EffectiveCommissionPolicy {
  id?: string;
  gamingCenterId: string;
  type: CommissionType;
  percentBps: number | null;
  fixedAmount: number | null;
  currency: string | null;
  monthlyTarget: number | null;
  maxPercentBps: number;
  applyToOnlineOnly: boolean;
  minimumFeeAmount: number | null;
  isActive: boolean;
  isPlatformDefault: boolean;
}

export async function resolveEffectiveCommissionPolicy(
  gamingCenterId: string,
  tx?: Prisma.TransactionClient
): Promise<EffectiveCommissionPolicy | null> {
  const policy = await CommissionsRepo.findPolicyByGamingCenterId(gamingCenterId, tx);
  if (policy) {
    if (!policy.isActive) {
      return null;
    }
    return {
      ...policy,
      isPlatformDefault: false,
    };
  }

  if (typeof CommissionsRepo.findPlatformDefaultCommissionPercent !== 'function') {
    return null;
  }

  const defaultPercent = await CommissionsRepo.findPlatformDefaultCommissionPercent(tx);
  if (typeof defaultPercent !== 'number' || !Number.isFinite(defaultPercent) || defaultPercent < 0) {
    return null;
  }

  const percentBps = Math.min(10000, Math.max(0, Math.round(defaultPercent * 100)));
  return {
    gamingCenterId,
    type: CommissionType.PERCENT,
    percentBps,
    fixedAmount: null,
    currency: 'IRR',
    monthlyTarget: null,
    maxPercentBps: 10000,
    applyToOnlineOnly: true,
    minimumFeeAmount: null,
    isActive: true,
    isPlatformDefault: true,
  };
}

export async function evaluateMonthlyTarget(
  gamingCenterId: string,
  policy: EffectiveCommissionPolicy,
  referenceDate: Date,
  tx?: Prisma.TransactionClient
): Promise<{
  targetPeriod: string;
  targetReached: boolean;
  targetContribution: boolean;
}> {
  const settings =
    typeof CommissionsRepo.findSettingsByGamingCenterId === 'function'
      ? await CommissionsRepo.findSettingsByGamingCenterId(gamingCenterId, tx)
      : null;
  const targetPeriod = getTargetPeriod(referenceDate, settings?.timeZone);

  if (policy.monthlyTarget === null || policy.monthlyTarget === undefined) {
    return {
      targetPeriod,
      targetReached: false,
      targetContribution: true,
    };
  }

  if (policy.monthlyTarget === 0) {
    return {
      targetPeriod,
      targetReached: true,
      targetContribution: false,
    };
  }

  if (typeof CommissionsRepo.countTargetContributions !== 'function') {
    return {
      targetPeriod,
      targetReached: false,
      targetContribution: true,
    };
  }

  const currentCount = await CommissionsRepo.countTargetContributions(gamingCenterId, targetPeriod, tx);
  if (currentCount >= policy.monthlyTarget) {
    return {
      targetPeriod,
      targetReached: true,
      targetContribution: false,
    };
  }

  return {
    targetPeriod,
    targetReached: false,
    targetContribution: true,
  };
}

export function computeCommissionAmount(
  basePrice: number,
  policy: Pick<EffectiveCommissionPolicy, 'type' | 'percentBps' | 'fixedAmount' | 'minimumFeeAmount'>,
  targetReached: boolean
): number {
  if (targetReached) {
    return 0;
  }

  let commissionAmount = 0;
  if (policy.type === CommissionType.PERCENT && policy.percentBps) {
    commissionAmount = Math.round((basePrice * policy.percentBps) / 10000);
  } else if (policy.type === CommissionType.FIXED && policy.fixedAmount) {
    commissionAmount = policy.fixedAmount;
  }

  if (policy.minimumFeeAmount && commissionAmount < policy.minimumFeeAmount) {
    commissionAmount = policy.minimumFeeAmount;
  }

  return commissionAmount;
}

export function computeMerchantPayoutAmount(
  basePrice: number,
  discountAmount: number,
  discountFundingSource: DiscountFundingSource | null | undefined,
  commissionAmount: number
): number {
  const gross =
    discountFundingSource === DiscountFundingSource.MERCHANT_FUNDED
      ? Math.max(0, basePrice - discountAmount)
      : basePrice;
  return Math.max(0, gross - commissionAmount);
}
