import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DiscountTargetType, DiscountValueType, Discount } from '@prisma/client';
import {
  calculateDiscountAmount,
  selectBestDiscount,
  discountsStation,
  validateCampaignForReservation,
} from '../../../../src/modules/discounts/discounts.station';
import { createPlatformCampaignSchema } from '../../../../src/modules/platform-admin/campaigns.validators';
import { prisma } from '../../../../src/config/prisma';
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

  describe('Enhanced Platform Campaign Targeting & Schedule', () => {
    const baseCampaign: any = {
      id: 'camp-1',
      title: 'Campaign',
      name: 'Campaign',
      code: 'CAMP1',
      codeType: 'PROMO_CODE',
      status: 'ACTIVE',
      isActive: true,
      deletedAt: null,
      startAt: new Date('2026-01-01T00:00:00Z'),
      endAt: new Date('2027-12-31T23:59:59Z'),
      scopeType: 'GLOBAL',
      targetType: 'GAMING_CENTER',
      targetId: null,
      applicableGamecenterIds: [],
      applicableDeviceTypes: [],
      applicableStationIds: [],
      targetAudience: 'ALL_USERS',
      specificUserIds: [],
      minCompletedReservations: 1,
      applicableDaysOfWeek: [],
      dailyStartTime: null,
      dailyEndTime: null,
      discountType: 'PERCENTAGE',
      valueType: 'PERCENTAGE',
      discountValue: 20,
      value: 20,
      maxDiscountAmount: null,
      minOrderAmount: 0,
      minReservationAmount: 0,
      totalUsageLimit: null,
      maxUsageCount: null,
      currentUsageCount: 0,
    };

    it('checks LOYAL_USERS with configurable minCompletedReservations (default 1) even without tx', async () => {
      const countSpy = jest.spyOn(prisma.reservation, 'count').mockResolvedValueOnce(1);

      const validRes = await validateCampaignForReservation(
        { ...baseCampaign, targetAudience: 'LOYAL_USERS', minCompletedReservations: 1 },
        'st-1',
        100000,
        'cust-1',
        new Date('2026-06-15T10:00:00Z'),
        undefined,
        'gc-1'
      );
      expect(validRes.isValid).toBe(true);
      expect(validRes.discountAmount).toBe(20000);

      countSpy.mockResolvedValueOnce(1);
      const invalidRes = await validateCampaignForReservation(
        { ...baseCampaign, targetAudience: 'LOYAL_USERS', minCompletedReservations: 3 },
        'st-1',
        100000,
        'cust-1',
        new Date('2026-06-15T10:00:00Z'),
        undefined,
        'gc-1'
      );
      expect(invalidRes.isValid).toBe(false);
      countSpy.mockRestore();
    });

    it('supports combined gamecenter + deviceType + stationId targeting', async () => {
      MockedReservationRepo.findStation.mockResolvedValue({
        id: 'st-1',
        stationType: 'PLAYSTATION_5',
      } as any);

      const campaign = {
        ...baseCampaign,
        applicableGamecenterIds: ['gc-1'],
        applicableDeviceTypes: ['PLAYSTATION_5'],
        applicableStationIds: ['st-1'],
      };

      const ok = await validateCampaignForReservation(
        campaign,
        'st-1',
        100000,
        undefined,
        new Date('2026-06-15T10:00:00Z'),
        undefined,
        'gc-1'
      );
      expect(ok.isValid).toBe(true);

      const wrongStation = await validateCampaignForReservation(
        campaign,
        'st-2',
        100000,
        undefined,
        new Date('2026-06-15T10:00:00Z'),
        undefined,
        'gc-1'
      );
      expect(wrongStation.isValid).toBe(false);
    });

    it('enforces applicableDaysOfWeek and dailyStartTime/dailyEndTime in Asia/Tehran', async () => {
      // 2026-06-15T08:00:00Z is Monday (day=1) 11:30 in Asia/Tehran (+03:30)
      const campaign = {
        ...baseCampaign,
        applicableDaysOfWeek: [1], // Monday
        dailyStartTime: '10:00',
        dailyEndTime: '14:00',
      };

      const inWindow = await validateCampaignForReservation(
        campaign,
        'st-1',
        100000,
        undefined,
        new Date('2026-06-15T08:00:00Z'),
        undefined,
        'gc-1'
      );
      expect(inWindow.isValid).toBe(true);

      // 2026-06-15T12:00:00Z is Monday 15:30 in Asia/Tehran (outside 10:00-14:00)
      const outOfHours = await validateCampaignForReservation(
        campaign,
        'st-1',
        100000,
        undefined,
        new Date('2026-06-15T12:00:00Z'),
        undefined,
        'gc-1'
      );
      expect(outOfHours.isValid).toBe(false);
    });

    it('validates AUTOMATIC campaigns without code and rejects PROMO_CODE without code', () => {
      const autoResult = createPlatformCampaignSchema.safeParse({
        body: {
          title: 'Auto Campaign',
          codeType: 'AUTOMATIC',
          discountType: 'PERCENTAGE',
          discountValue: 15,
          minCompletedReservations: 1,
          applicableDaysOfWeek: [4, 5],
          dailyStartTime: '10:00',
          dailyEndTime: '16:00',
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-07-01T00:00:00.000Z',
        },
      });
      expect(autoResult.success).toBe(true);

      const promoWithoutCode = createPlatformCampaignSchema.safeParse({
        body: {
          title: 'Promo Campaign',
          codeType: 'PROMO_CODE',
          discountType: 'PERCENTAGE',
          discountValue: 15,
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-07-01T00:00:00.000Z',
        },
      });
      expect(promoWithoutCode.success).toBe(false);
    });
  });
});
