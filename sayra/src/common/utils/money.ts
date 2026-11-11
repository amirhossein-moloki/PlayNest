import { DiscountValueType } from '@prisma/client';

/**
 * Rounds a floating-point financial value safely to an integer minor monetary unit.
 * Prevents IEEE 754 floating-point rounding inaccuracies (e.g., 0.1 + 0.2 = 0.30000000000000004).
 */
import logger from '../../config/logger';

export const toMinorUnits = (amount: number): number => {
  if (isNaN(amount) || !isFinite(amount)) {
    return 0;
  }
  const rounded = Math.round(amount);
  if (!Number.isSafeInteger(rounded)) {
    logger.warn({ amount: rounded }, 'Monetary amount exceeds Number.MAX_SAFE_INTEGER threshold');
  }
  return rounded;
};

/**
 * Calculates base price given duration in hours and hourly rate/price,
 * returning an exact rounded monetary value.
 */
export const calculateBasePrice = (
  durationHours: number,
  hourlyPrice: number,
): number => {
  if (durationHours <= 0 || hourlyPrice <= 0) {
    return 0;
  }
  return toMinorUnits(durationHours * hourlyPrice);
};

/**
 * Calculates discount amount based on base price, value, and discount type (PERCENTAGE / FIXED_AMOUNT).
 * Clamps discount amount between 0 and basePrice.
 */
export const calculateDiscount = (
  basePrice: number,
  value: number,
  valueType: DiscountValueType | 'PERCENTAGE' | 'FIXED_AMOUNT',
): number => {
  if (basePrice <= 0 || value <= 0) {
    return 0;
  }

  let discountAmount = 0;
  const typeStr = String(valueType);
  if (typeStr === DiscountValueType.PERCENTAGE) {
    discountAmount = (basePrice * value) / 100;
  } else if (typeStr === DiscountValueType.FIXED_AMOUNT) {
    discountAmount = value;
  }

  const roundedDiscount = toMinorUnits(discountAmount);
  return Math.min(Math.max(0, roundedDiscount), basePrice);
};

/**
 * Calculates commission amount in basis points (1 bps = 0.01%, 10000 bps = 100%).
 */
export const calculateCommissionFromBps = (
  amount: number,
  percentBps: number,
): number => {
  if (amount <= 0 || percentBps <= 0) {
    return 0;
  }
  return toMinorUnits((amount * percentBps) / 10000);
};

export interface StationPricing {
  originalPrice: number;
  discountPercentage: number;
  discountAmount: number;
  finalPrice: number;
  hasDiscount: boolean;
  durationHours?: number;
}

/**
 * Calculates station pricing containing originalPrice, discountAmount, and finalPrice.
 * Guaranteed:
 * - finalPrice = max(0, originalPrice - discountAmount)
 * - discountAmount clamped between 0 and originalPrice
 * - No negative values
 */
export const calculateStationPricing = (
  hourlyPrice: number,
  discount?: {
    valueType: DiscountValueType | 'PERCENTAGE' | 'FIXED_AMOUNT';
    value: number;
    isActive?: boolean;
    startAt?: Date | string;
    endAt?: Date | string;
    maxDiscountAmount?: number | null;
  } | null,
  durationHours = 1,
  now: Date = new Date()
): StationPricing => {
  const originalPrice = calculateBasePrice(durationHours, hourlyPrice);

  if (originalPrice <= 0 || !discount) {
    return {
      originalPrice,
      discountPercentage: 0,
      discountAmount: 0,
      finalPrice: originalPrice,
      hasDiscount: false,
      durationHours,
    };
  }

  // Check validity
  if (discount.isActive === false) {
    return {
      originalPrice,
      discountPercentage: 0,
      discountAmount: 0,
      finalPrice: originalPrice,
      hasDiscount: false,
      durationHours,
    };
  }

  if (discount.startAt && new Date(discount.startAt) > now) {
    return {
      originalPrice,
      discountPercentage: 0,
      discountAmount: 0,
      finalPrice: originalPrice,
      hasDiscount: false,
      durationHours,
    };
  }

  if (discount.endAt && new Date(discount.endAt) < now) {
    return {
      originalPrice,
      discountPercentage: 0,
      discountAmount: 0,
      finalPrice: originalPrice,
      hasDiscount: false,
      durationHours,
    };
  }

  if (discount.value <= 0) {
    return {
      originalPrice,
      discountPercentage: 0,
      discountAmount: 0,
      finalPrice: originalPrice,
      hasDiscount: false,
      durationHours,
    };
  }

  let discountAmount = 0;
  let discountPercentage = 0;
  const typeStr = String(discount.valueType);

  if (typeStr === DiscountValueType.PERCENTAGE) {
    discountPercentage = discount.value;
    discountAmount = (originalPrice * discount.value) / 100;
    if (discount.maxDiscountAmount !== undefined && discount.maxDiscountAmount !== null && discount.maxDiscountAmount > 0) {
      discountAmount = Math.min(discountAmount, discount.maxDiscountAmount);
    }
  } else if (typeStr === DiscountValueType.FIXED_AMOUNT) {
    discountAmount = discount.value;
    discountPercentage = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 10000) / 100 : 0;
  }

  const roundedDiscount = Math.min(originalPrice, Math.max(0, toMinorUnits(discountAmount)));
  const finalPrice = Math.max(0, originalPrice - roundedDiscount);

  return {
    originalPrice,
    discountPercentage: Math.round(discountPercentage * 100) / 100,
    discountAmount: roundedDiscount,
    finalPrice,
    hasDiscount: roundedDiscount > 0,
    durationHours,
  };
};
