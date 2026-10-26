import {
  toMinorUnits,
  calculateBasePrice,
  calculateDiscount,
  calculateCommissionFromBps,
} from '../../../../src/common/utils/money';
import { DiscountValueType } from '@prisma/client';

describe('Money Utilities (FIND-03 Data Integrity)', () => {
  describe('toMinorUnits', () => {
    it('should round floating-point math to nearest integer', () => {
      expect(toMinorUnits(0.1 + 0.2)).toBe(0); // 0.3 -> 0
      expect(toMinorUnits(100.4)).toBe(100);
      expect(toMinorUnits(100.5)).toBe(101);
      expect(toMinorUnits(100.6)).toBe(101);
    });

    it('should handle zero and edge cases', () => {
      expect(toMinorUnits(0)).toBe(0);
      expect(toMinorUnits(NaN)).toBe(0);
      expect(toMinorUnits(Infinity)).toBe(0);
      expect(toMinorUnits(-Infinity)).toBe(0);
    });
  });

  describe('calculateBasePrice', () => {
    it('should calculate base price accurately without floating-point inaccuracies', () => {
      expect(calculateBasePrice(1.5, 60000)).toBe(90000);
      expect(calculateBasePrice(2.33, 50000)).toBe(116500); // 116500 exact
    });

    it('should return 0 for zero or negative hours/rates', () => {
      expect(calculateBasePrice(0, 50000)).toBe(0);
      expect(calculateBasePrice(2, 0)).toBe(0);
      expect(calculateBasePrice(-1, 50000)).toBe(0);
    });
  });

  describe('calculateDiscount', () => {
    it('should calculate percentage discounts accurately and round to integer', () => {
      // 100,000 * 15% = 15,000
      expect(calculateDiscount(100000, 15, DiscountValueType.PERCENTAGE)).toBe(15000);
      // 33,333 * 10% = 3333.3 -> 3333
      expect(calculateDiscount(33333, 10, DiscountValueType.PERCENTAGE)).toBe(3333);
    });

    it('should calculate fixed amount discounts', () => {
      expect(calculateDiscount(100000, 20000, DiscountValueType.FIXED_AMOUNT)).toBe(20000);
    });

    it('should clamp discount to not exceed base price', () => {
      expect(calculateDiscount(50000, 100000, DiscountValueType.FIXED_AMOUNT)).toBe(50000);
      expect(calculateDiscount(50000, 150, DiscountValueType.PERCENTAGE)).toBe(50000);
    });

    it('should return 0 for non-positive input values', () => {
      expect(calculateDiscount(0, 10, DiscountValueType.PERCENTAGE)).toBe(0);
      expect(calculateDiscount(100000, 0, DiscountValueType.PERCENTAGE)).toBe(0);
      expect(calculateDiscount(100000, -5, DiscountValueType.FIXED_AMOUNT)).toBe(0);
    });
  });

  describe('calculateCommissionFromBps', () => {
    it('should calculate commission from basis points accurately', () => {
      // 250 BPS = 2.5%, 100,000 * 2.5% = 2,500
      expect(calculateCommissionFromBps(100000, 250)).toBe(2500);
      // 10,000 BPS = 100%
      expect(calculateCommissionFromBps(50000, 10000)).toBe(50000);
    });

    it('should return 0 for non-positive inputs', () => {
      expect(calculateCommissionFromBps(0, 250)).toBe(0);
      expect(calculateCommissionFromBps(100000, 0)).toBe(0);
    });
  });
});
