import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DiscountTargetType, DiscountValueType, Discount } from '@prisma/client';
import { calculateDiscountAmount, selectBestDiscount, discountsStation } from '../../../../src/modules/discounts/discounts.station';
import { DiscountsRepo } from '../../../../src/modules/discounts/discounts.repo';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import AppError from '../../../../src/common/errors/AppError';

jest.mock('../../../../src/modules/discounts/discounts.repo');
jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/audit/audit.station');

const MockedDiscountsRepo = DiscountsRepo as jest.Mocked<typeof DiscountsRepo>;
const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Discounts Unit Tests', () => {
  const gamingCenterId = 'gc-100';
  const stationId = 'st-200';
  const userId = 'user-300';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateDiscountAmount', () => {
    it('should calculate percentage discount correctly', () => {
      const amount = calculateDiscountAmount(500000, DiscountValueType.PERCENTAGE, 20);
      expect(amount).toBe(100000);
    });

    it('should calculate fixed amount discount correctly', () => {
      const amount = calculateDiscountAmount(500000, DiscountValueType.FIXED_AMOUNT, 50000);
      expect(amount).toBe(50000);
    });

    it('should cap discount amount at base price so final price never becomes negative', () => {
      const amount = calculateDiscountAmount(100000, DiscountValueType.FIXED_AMOUNT, 150000);
      expect(amount).toBe(100000);
    });

    it('should return 0 when basePrice is 0 or value is 0', () => {
      expect(calculateDiscountAmount(0, DiscountValueType.PERCENTAGE, 20)).toBe(0);
      expect(calculateDiscountAmount(500000, DiscountValueType.PERCENTAGE, 0)).toBe(0);
    });
  });

  describe('selectBestDiscount Precedence Logic', () => {
    const gcDiscount: Discount = {
      id: 'd-gc',
      gamingCenterId,
      targetType: DiscountTargetType.GAMING_CENTER,
      targetId: gamingCenterId,
      valueType: DiscountValueType.PERCENTAGE,
      value: 30, // 150,000 on 500,000
      startAt: new Date(),
      endAt: new Date(Date.now() + 100000),
      isActive: true,
      createdByUserId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const stationDiscount: Discount = {
      id: 'd-st',
      gamingCenterId,
      targetType: DiscountTargetType.STATION,
      targetId: stationId,
      valueType: DiscountValueType.PERCENTAGE,
      value: 10, // 50,000 on 500,000
      startAt: new Date(),
      endAt: new Date(Date.now() + 100000),
      isActive: true,
      createdByUserId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should give STATION discount priority over GAMING_CENTER discount regardless of value', () => {
      const result = selectBestDiscount([gcDiscount, stationDiscount], 500000);
      expect(result.applicableDiscount?.id).toBe('d-st');
      expect(result.discountAmount).toBe(50000);
    });

    it('should choose the discount yielding the maximum discount amount when multiple discounts exist at the same level', () => {
      const stationDiscount2: Discount = {
        ...stationDiscount,
        id: 'd-st-2',
        value: 20, // 100,000 on 500,000
      };

      const result = selectBestDiscount([stationDiscount, stationDiscount2], 500000);
      expect(result.applicableDiscount?.id).toBe('d-st-2');
      expect(result.discountAmount).toBe(100000);
    });

    it('should return null discount when candidate list is empty', () => {
      const result = selectBestDiscount([], 500000);
      expect(result.applicableDiscount).toBeNull();
      expect(result.discountAmount).toBe(0);
    });
  });

  describe('Target Validation & CRUD', () => {
    it('should reject creating GAMING_CENTER discount with mismatched targetId', async () => {
      await expect(
        discountsStation.createDiscount(gamingCenterId, userId, {
          targetType: DiscountTargetType.GAMING_CENTER,
          targetId: 'other-gc',
          valueType: DiscountValueType.PERCENTAGE,
          value: 10,
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 86400000).toISOString(),
          isActive: true,
        })
      ).rejects.toThrow(AppError);
    });

    it('should reject creating STATION discount if GameStation does not exist', async () => {
      MockedReservationRepo.findStation.mockResolvedValue(null);

      await expect(
        discountsStation.createDiscount(gamingCenterId, userId, {
          targetType: DiscountTargetType.STATION,
          targetId: stationId,
          valueType: DiscountValueType.PERCENTAGE,
          value: 10,
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 86400000).toISOString(),
          isActive: true,
        })
      ).rejects.toThrow(AppError);
    });

    it('should create valid STATION discount successfully', async () => {
      const station = { id: stationId, name: 'PC 1' };
      const createdDiscount = {
        id: 'd-1',
        gamingCenterId,
        targetType: DiscountTargetType.STATION,
        targetId: stationId,
        valueType: DiscountValueType.PERCENTAGE,
        value: 15,
        startAt: new Date(),
        endAt: new Date(Date.now() + 86400000),
        isActive: true,
        createdByUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      MockedReservationRepo.findStation.mockResolvedValue(station as any);
      MockedDiscountsRepo.createDiscount.mockResolvedValue(createdDiscount as any);

      const result = await discountsStation.createDiscount(gamingCenterId, userId, {
        targetType: DiscountTargetType.STATION,
        targetId: stationId,
        valueType: DiscountValueType.PERCENTAGE,
        value: 15,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
        isActive: true,
      });

      expect(result).toEqual(createdDiscount);
      expect(MockedDiscountsRepo.createDiscount).toHaveBeenCalled();
    });
  });
});
