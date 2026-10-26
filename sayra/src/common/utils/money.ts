import { DiscountValueType } from '@prisma/client';

/**
 * Rounds a floating-point financial value safely to an integer minor monetary unit.
 * Prevents IEEE 754 floating-point rounding inaccuracies (e.g., 0.1 + 0.2 = 0.30000000000000004).
 */
export const toMinorUnits = (amount: number): number => {
  if (isNaN(amount) || !isFinite(amount)) {
    return 0;
  }
  return Math.round(amount);
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
