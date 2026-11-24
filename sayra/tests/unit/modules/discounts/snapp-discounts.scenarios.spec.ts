/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  DiscountTargetType,
  DiscountValueType,
  DiscountFundingSource,
  DiscountUsageStatus,
  DiscountCampaign,
  Discount,
  DiscountUsage,
} from '@prisma/client';
import {
  discountsStation,
  calculateFinancialBreakdown,
} from '../../../../src/modules/discounts/discounts.station';
import { DiscountsRepo } from '../../../../src/modules/discounts/discounts.repo';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import AppError from '../../../../src/common/errors/AppError';

jest.mock('../../../../src/modules/discounts/discounts.repo');
jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/audit/audit.station');
jest.mock('../../../../src/modules/commissions/commission-calculator', () => ({
  resolveEffectiveCommissionPolicy: (jest.fn() as any).mockResolvedValue({
    rate: 5,
    fixedAmount: 0,
    applyToOnlineOnly: false,
  }),
  evaluateMonthlyTarget: (jest.fn() as any).mockResolvedValue({ targetReached: false }),
  computeCommissionAmount: jest.fn((basePrice: number) => (basePrice * 5) / 100),
  computeMerchantPayoutAmount: jest.fn(
    (basePrice: number, discountAmount: number, fundingSource: any, commission: number) => {
      const gross = fundingSource === 'MERCHANT_FUNDED' ? Math.max(0, basePrice - discountAmount) : basePrice;
      return Math.max(0, gross - commission);
    }
  ),
}));

const MockedDiscountsRepo = DiscountsRepo as jest.Mocked<typeof DiscountsRepo>;
const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;

describe('Snapp-like Multi-Discount System - 15 Essential Scenarios', () => {
  const gamingCenterId = 'gc-snapp-100';
  const stationId = 'st-ps5-200';
  const customerAccountId = 'cust-user-300';
  const basePrice = 100000; // 100,000 Toman

  const now = new Date('2026-12-01T12:00:00Z');
  const futureDate = new Date('2026-12-30T12:00:00Z');
  const pastDate = new Date('2026-11-01T12:00:00Z');

  // Direct Station Discount: 15,000 Toman flat discount
  const mockDirectDiscount: Discount = {
    id: 'disc-direct-1',
    gamingCenterId,
    targetType: DiscountTargetType.STATION,
    targetId: stationId,
    valueType: DiscountValueType.FIXED_AMOUNT,
    value: 15000,
    startAt: pastDate,
    endAt: futureDate,
    isActive: true,
    createdByUserId: 'staff-1',
    createdAt: pastDate,
    updatedAt: pastDate,
  };

  // Platform Campaign: 20% discount up to 50,000 Toman (saves 20,000 on 100,000)
  const mockPlatformCampaign: DiscountCampaign = {
    id: 'camp-platform-yalda',
    gamingCenterId: null, // Global
    title: 'جشنواره سراسری یلدا',
    name: 'جشنواره سراسری یلدا',
    code: 'YALDA20',
    codeType: 'PROMO_CODE',
    description: '۲۰٪ تخفیف سراسری پلتفرم',
    discountType: DiscountValueType.PERCENTAGE,
    discountValue: 20,
    minOrderAmount: 50000,
    scopeType: 'GLOBAL',
    applicableGamecenterIds: [],
    applicableDeviceTypes: [],
    targetAudience: 'ALL_USERS',
    specificUserIds: [],
    totalUsageLimit: 100,
    perUserUsageLimit: 1,
    status: 'ACTIVE',
    deletedAt: null,
    targetType: DiscountTargetType.GAMING_CENTER,
    targetId: null,
    valueType: DiscountValueType.PERCENTAGE,
    value: 20,
    maxDiscountAmount: 50000,
    minReservationAmount: 50000,
    fundingSource: DiscountFundingSource.PLATFORM,
    totalBudget: 10000000,
    usedBudget: 200000,
    maxUsageCount: 100,
    currentUsageCount: 10,
    maxUsagePerUser: 1,
    startAt: pastDate,
    endAt: futureDate,
    isActive: true,
    createdByUserId: null,
    createdAt: pastDate,
    updatedAt: pastDate,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockedDiscountsRepo.transaction.mockImplementation(async (cb: any) => cb({} as any));
    MockedReservationRepo.findStation.mockResolvedValue({
      id: stationId,
      name: 'PS5 Station 1',
      hourlyPrice: 100000,
      stationType: 'PLAYSTATION_5' as any,
    } as any);
  });

  // -------------------------------------------------------------
  // Scenario 1: Multiple discounts active simultaneously
  // -------------------------------------------------------------
  it('Scenario 1: should discover all simultaneously active discounts (direct & campaigns) and evaluate eligibility', async () => {
    MockedDiscountsRepo.findActiveApplicableDiscounts.mockResolvedValue([mockDirectDiscount]);
    MockedDiscountsRepo.findActiveApplicableCampaigns.mockResolvedValue([mockPlatformCampaign]);
    MockedDiscountsRepo.countUserCampaignUsages.mockResolvedValue(0);

    const result = await discountsStation.getAvailableDiscounts(gamingCenterId, {
      stationId,
      basePrice,
      startTime: now.toISOString(),
      customerAccountId,
    });

    expect(result.discounts).toHaveLength(2);
    expect(result.discounts.some((d) => d.type === 'DIRECT_DISCOUNT')).toBe(true);
    expect(result.discounts.some((d) => d.type === 'CAMPAIGN')).toBe(true);
    expect(result.discounts.every((d) => d.isApplicable)).toBe(true);
  });

  // -------------------------------------------------------------
  // Scenario 2: User selects best recommended discount
  // -------------------------------------------------------------
  it('Scenario 2: should identify and recommend the discount providing highest monetary savings', async () => {
    MockedDiscountsRepo.findActiveApplicableDiscounts.mockResolvedValue([mockDirectDiscount]); // saves 15,000
    MockedDiscountsRepo.findActiveApplicableCampaigns.mockResolvedValue([mockPlatformCampaign]); // saves 20,000
    MockedDiscountsRepo.countUserCampaignUsages.mockResolvedValue(0);

    const available = await discountsStation.getAvailableDiscounts(gamingCenterId, {
      stationId,
      basePrice,
      startTime: now.toISOString(),
      customerAccountId,
    });

    expect(available.recommendedDiscountId).toBe(mockPlatformCampaign.id);
    const bestDiscount = available.discounts.find((d) => d.id === available.recommendedDiscountId);
    expect(bestDiscount?.isBest).toBe(true);
    expect(bestDiscount?.badge).toBe('بهترین تخفیف برای شما');
    expect(bestDiscount?.discountAmount).toBe(20000); // 20,000 > 15,000
  });

  // -------------------------------------------------------------
  // Scenario 3: User explicitly chooses another discount
  // -------------------------------------------------------------
  it('Scenario 3: should respect user selection when choosing a smaller discount without silent overrides, but notify them of a better deal', async () => {
    MockedDiscountsRepo.findById.mockResolvedValue(mockDirectDiscount);
    MockedDiscountsRepo.findActiveApplicableDiscounts.mockResolvedValue([mockDirectDiscount]); // saves 15,000
    MockedDiscountsRepo.findActiveApplicableCampaigns.mockResolvedValue([mockPlatformCampaign]); // saves 20,000
    MockedDiscountsRepo.countUserCampaignUsages.mockResolvedValue(0);

    const calc = await discountsStation.calculateDiscountSelection(gamingCenterId, {
      stationId,
      basePrice,
      startTime: now.toISOString(),
      customerAccountId,
      selectedDiscountId: mockDirectDiscount.id,
      selectedType: 'DIRECT_DISCOUNT',
    });

    // Applied discount remains what the user chose
    expect(calc.appliedDiscount.id).toBe(mockDirectDiscount.id);
    expect(calc.discountAmount).toBe(15000);
    // User is informed that a better discount exists with difference calculation
    expect(calc.betterDiscountAvailable).toBe(true);
    expect(calc.betterDiscount?.id).toBe(mockPlatformCampaign.id);
    expect(calc.betterDiscount?.savingsDifference).toBe(5000); // 20,000 - 15,000
  });

  // -------------------------------------------------------------
  // Scenario 4: User enters manual promo code
  // -------------------------------------------------------------
  it('Scenario 4: should validate and apply manual promo code entered by user', async () => {
    MockedDiscountsRepo.findCampaignByCode.mockResolvedValue(mockPlatformCampaign);
    MockedDiscountsRepo.findActiveApplicableDiscounts.mockResolvedValue([]);
    MockedDiscountsRepo.findActiveApplicableCampaigns.mockResolvedValue([mockPlatformCampaign]);
    MockedDiscountsRepo.countUserCampaignUsages.mockResolvedValue(0);

    const calc = await discountsStation.calculateDiscountSelection(gamingCenterId, {
      stationId,
      basePrice,
      startTime: now.toISOString(),
      customerAccountId,
      code: 'YALDA20',
    });

    expect(calc.isValid).toBe(true);
    expect(calc.appliedDiscount.code).toBe('YALDA20');
    expect(calc.discountAmount).toBe(20000);
    expect(calc.customerPayableAmount).toBe(80000);
  });

  // -------------------------------------------------------------
  // Scenario 5: Expired code validation
  // -------------------------------------------------------------
  it('Scenario 5: should reject expired promo code with descriptive error', async () => {
    const expiredCampaign: DiscountCampaign = {
      ...mockPlatformCampaign,
      id: 'camp-expired',
      code: 'EXPIRED_CODE',
      endAt: pastDate, // expired in the past
    };
    MockedDiscountsRepo.findCampaignByCode.mockResolvedValue(expiredCampaign);

    await expect(
      discountsStation.calculateDiscountSelection(gamingCenterId, {
        stationId,
        basePrice,
        startTime: now.toISOString(),
        customerAccountId,
        code: 'EXPIRED_CODE',
      })
    ).rejects.toThrow(AppError);
  });

  // -------------------------------------------------------------
  // Scenario 6: Usage limit reached
  // -------------------------------------------------------------
  it('Scenario 6: should reject discount when per-user usage limit is reached', async () => {
    MockedDiscountsRepo.findCampaignByCode.mockResolvedValue(mockPlatformCampaign);
    MockedDiscountsRepo.countUserCampaignUsages.mockResolvedValue(1); // Already used 1/1

    await expect(
      discountsStation.calculateDiscountSelection(gamingCenterId, {
        stationId,
        basePrice,
        startTime: now.toISOString(),
        customerAccountId,
        code: 'YALDA20',
      })
    ).rejects.toThrow(AppError);
  });

  // -------------------------------------------------------------
  // Scenario 7: Payment failure -> Auto release
  // -------------------------------------------------------------
  it('Scenario 7: should release reserved discount when payment fails, restoring campaign budget and count', async () => {
    const usageId = 'usage-reserved-1';
    const mockReservedUsage: DiscountUsage = {
      id: usageId,
      campaignId: mockPlatformCampaign.id,
      discountId: null,
      reservationId: 'res-failed-1',
      bookingHoldId: null,
      customerAccountId,
      discountAmount: 20000,
      originalPrice: 100000,
      finalPrice: 80000,
      fundingSource: DiscountFundingSource.PLATFORM,
      status: DiscountUsageStatus.RESERVED,
      reservedAt: now,
      redeemedAt: null,
      releasedAt: null,
      releaseReason: null,
      expiresAt: new Date(now.getTime() + 15 * 60000),
      idempotencyKey: null,
      voucherCode: 'YALDA20',
      createdAt: now,
      updatedAt: now,
    };

    MockedDiscountsRepo.findActiveUsageForReservation.mockResolvedValue(mockReservedUsage);
    MockedDiscountsRepo.lockCampaignForUpdate.mockResolvedValue(mockPlatformCampaign);
    MockedDiscountsRepo.updateCampaign.mockResolvedValue({
      ...mockPlatformCampaign,
      usedBudget: mockPlatformCampaign.usedBudget - 20000,
      currentUsageCount: mockPlatformCampaign.currentUsageCount - 1,
    });
    MockedDiscountsRepo.updateDiscountUsage.mockResolvedValue({
      ...mockReservedUsage,
      status: DiscountUsageStatus.RELEASED,
      releasedAt: new Date(),
      releaseReason: 'Payment failed at gateway',
    });

    const released = await discountsStation.releaseDiscountForReservation(
      'res-failed-1',
      'Payment failed at gateway'
    );

    expect(released?.status).toBe(DiscountUsageStatus.RELEASED);
    expect(MockedDiscountsRepo.updateCampaign).toHaveBeenCalledWith(
      mockPlatformCampaign.id,
      {
        usedBudget: mockPlatformCampaign.usedBudget - 20000,
        currentUsageCount: mockPlatformCampaign.currentUsageCount - 1,
      },
      expect.anything()
    );
  });

  // -------------------------------------------------------------
  // Scenario 8: Reservation failure / hold conversion conflict -> Auto release
  // -------------------------------------------------------------
  it('Scenario 8: should release discount hold when booking hold cannot be converted', async () => {
    const holdId = 'hold-conflict-1';
    const mockHoldUsage: DiscountUsage = {
      id: 'usage-hold-1',
      campaignId: mockPlatformCampaign.id,
      discountId: null,
      reservationId: null,
      bookingHoldId: holdId,
      customerAccountId,
      discountAmount: 20000,
      originalPrice: 100000,
      finalPrice: 80000,
      fundingSource: DiscountFundingSource.PLATFORM,
      status: DiscountUsageStatus.RESERVED,
      reservedAt: now,
      redeemedAt: null,
      releasedAt: null,
      releaseReason: null,
      expiresAt: new Date(now.getTime() + 15 * 60000),
      idempotencyKey: null,
      voucherCode: 'YALDA20',
      createdAt: now,
      updatedAt: now,
    };

    MockedDiscountsRepo.findActiveUsageForHold.mockResolvedValue(mockHoldUsage);
    MockedDiscountsRepo.lockCampaignForUpdate.mockResolvedValue(mockPlatformCampaign);
    MockedDiscountsRepo.updateCampaign.mockResolvedValue(mockPlatformCampaign);
    MockedDiscountsRepo.updateDiscountUsage.mockResolvedValue({
      ...mockHoldUsage,
      status: DiscountUsageStatus.RELEASED,
      releaseReason: 'Slot conflict detected during reservation creation',
    });

    const result = await discountsStation.releaseDiscountForBookingHold(
      holdId,
      'Slot conflict detected during reservation creation'
    );

    expect(result?.status).toBe(DiscountUsageStatus.RELEASED);
  });

  // -------------------------------------------------------------
  // Scenario 9: User cancels reservation -> Discount restored
  // -------------------------------------------------------------
  it('Scenario 9: should return voucher credit when user cancels confirmed reservation', async () => {
    const resId = 'res-user-cancel-1';
    const mockRedeemedUsage: DiscountUsage = {
      id: 'usage-user-cancel-1',
      campaignId: mockPlatformCampaign.id,
      discountId: null,
      reservationId: resId,
      bookingHoldId: null,
      customerAccountId,
      discountAmount: 20000,
      originalPrice: 100000,
      finalPrice: 80000,
      fundingSource: DiscountFundingSource.PLATFORM,
      status: DiscountUsageStatus.REDEEMED,
      reservedAt: now,
      redeemedAt: now,
      releasedAt: null,
      releaseReason: null,
      expiresAt: null,
      idempotencyKey: null,
      voucherCode: 'YALDA20',
      createdAt: now,
      updatedAt: now,
    };

    MockedDiscountsRepo.findActiveUsageForReservation.mockResolvedValue(mockRedeemedUsage);
    MockedDiscountsRepo.lockCampaignForUpdate.mockResolvedValue(mockPlatformCampaign);
    MockedDiscountsRepo.updateCampaign.mockResolvedValue(mockPlatformCampaign);
    MockedDiscountsRepo.updateDiscountUsage.mockResolvedValue({
      ...mockRedeemedUsage,
      status: DiscountUsageStatus.RELEASED,
      releaseReason: 'Customer requested cancellation',
    });

    const result = await discountsStation.releaseDiscountForReservation(
      resId,
      'Customer requested cancellation'
    );

    expect(result?.status).toBe(DiscountUsageStatus.RELEASED);
  });

  // -------------------------------------------------------------
  // Scenario 10: Gaming center cancels reservation -> Discount restored
  // -------------------------------------------------------------
  it('Scenario 10: should automatically release discount when gaming center staff cancels reservation', async () => {
    const resId = 'res-staff-cancel-1';
    const mockUsage: DiscountUsage = {
      id: 'usage-staff-cancel-1',
      campaignId: mockPlatformCampaign.id,
      discountId: null,
      reservationId: resId,
      bookingHoldId: null,
      customerAccountId,
      discountAmount: 20000,
      originalPrice: 100000,
      finalPrice: 80000,
      fundingSource: DiscountFundingSource.PLATFORM,
      status: DiscountUsageStatus.REDEEMED,
      reservedAt: now,
      redeemedAt: now,
      releasedAt: null,
      releaseReason: null,
      expiresAt: null,
      idempotencyKey: null,
      voucherCode: 'YALDA20',
      createdAt: now,
      updatedAt: now,
    };

    MockedDiscountsRepo.findActiveUsageForReservation.mockResolvedValue(mockUsage);
    MockedDiscountsRepo.lockCampaignForUpdate.mockResolvedValue(mockPlatformCampaign);
    MockedDiscountsRepo.updateCampaign.mockResolvedValue(mockPlatformCampaign);
    MockedDiscountsRepo.updateDiscountUsage.mockResolvedValue({
      ...mockUsage,
      status: DiscountUsageStatus.RELEASED,
      releaseReason: 'Station maintenance by staff',
    });

    const result = await discountsStation.releaseDiscountForReservation(
      resId,
      'Station maintenance by staff'
    );

    expect(result?.status).toBe(DiscountUsageStatus.RELEASED);
  });

  // -------------------------------------------------------------
  // Scenario 11: System/Server error & Expired hold reaping
  // -------------------------------------------------------------
  it('Scenario 11: should reap expired discount holds and restore budget when hold times out', async () => {
    const expiredUsage: DiscountUsage = {
      id: 'usage-stale-hold',
      campaignId: mockPlatformCampaign.id,
      discountId: null,
      reservationId: null,
      bookingHoldId: 'hold-stale',
      customerAccountId,
      discountAmount: 20000,
      originalPrice: 100000,
      finalPrice: 80000,
      fundingSource: DiscountFundingSource.PLATFORM,
      status: DiscountUsageStatus.RESERVED,
      reservedAt: new Date(now.getTime() - 30 * 60000), // 30 min ago
      redeemedAt: null,
      releasedAt: null,
      releaseReason: null,
      expiresAt: new Date(now.getTime() - 15 * 60000), // expired 15 min ago
      idempotencyKey: null,
      voucherCode: 'YALDA20',
      createdAt: pastDate,
      updatedAt: pastDate,
    };

    MockedDiscountsRepo.findExpiredReservedUsages.mockResolvedValue([expiredUsage]);
    MockedDiscountsRepo.findUsageById.mockResolvedValue(expiredUsage);
    MockedDiscountsRepo.lockCampaignForUpdate.mockResolvedValue(mockPlatformCampaign);
    MockedDiscountsRepo.updateCampaign.mockResolvedValue(mockPlatformCampaign);
    MockedDiscountsRepo.updateDiscountUsage.mockResolvedValue({
      ...expiredUsage,
      status: DiscountUsageStatus.RELEASED,
      releaseReason: 'HOLD_EXPIRED',
    });

    const reaped = await discountsStation.reapExpiredDiscountHolds(now);

    expect(reaped).toHaveLength(1);
    expect(reaped[0].status).toBe(DiscountUsageStatus.RELEASED);
  });

  // -------------------------------------------------------------
  // Scenario 12: Duplicate requests with Idempotency Key
  // -------------------------------------------------------------
  it('Scenario 12: should return existing active reservation idempotently when repeated request is sent', async () => {
    const idempotencyKey = 'idem-unique-key-123';
    const existingUsage: DiscountUsage = {
      id: 'usage-idem-1',
      campaignId: mockPlatformCampaign.id,
      discountId: null,
      reservationId: null,
      bookingHoldId: null,
      customerAccountId,
      discountAmount: 20000,
      originalPrice: 100000,
      finalPrice: 80000,
      fundingSource: DiscountFundingSource.PLATFORM,
      status: DiscountUsageStatus.RESERVED,
      reservedAt: now,
      redeemedAt: null,
      releasedAt: null,
      releaseReason: null,
      expiresAt: new Date(now.getTime() + 15 * 60000),
      idempotencyKey,
      voucherCode: 'YALDA20',
      createdAt: now,
      updatedAt: now,
    };

    MockedDiscountsRepo.findUsageByIdempotencyKey.mockResolvedValue(existingUsage);

    const result = await discountsStation.reserveDiscount(gamingCenterId, {
      stationId,
      basePrice,
      customerAccountId,
      code: 'YALDA20',
      idempotencyKey,
    });

    expect(result.id).toBe(existingUsage.id);
    expect(MockedDiscountsRepo.createDiscountUsage).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------
  // Scenario 13: Concurrent users on a scarce/limited campaign
  // -------------------------------------------------------------
  it('Scenario 13: should block concurrent second user under pessimistic lock when total usage limit is reached', async () => {
    const scarceCampaign: DiscountCampaign = {
      ...mockPlatformCampaign,
      totalUsageLimit: 1,
      currentUsageCount: 1, // already at limit under lock
    };

    MockedDiscountsRepo.findCampaignByCode.mockResolvedValue(scarceCampaign);
    MockedDiscountsRepo.lockCampaignForUpdate.mockResolvedValue(scarceCampaign);
    MockedDiscountsRepo.countUserCampaignUsages.mockResolvedValue(0);

    await expect(
      discountsStation.reserveDiscount(gamingCenterId, {
        stationId,
        basePrice,
        customerAccountId: 'user-2',
        code: 'YALDA20',
      })
    ).rejects.toThrow(AppError);
  });

  // -------------------------------------------------------------
  // Scenario 14: User reuses discount after release
  // -------------------------------------------------------------
  it('Scenario 14: should allow user to reuse voucher after previous reservation hold was released', async () => {
    // When countUserCampaignUsages counts active (RESERVED/REDEEMED) usages, released rows return 0
    MockedDiscountsRepo.countUserCampaignUsages.mockResolvedValue(0);
    MockedDiscountsRepo.findCampaignByCode.mockResolvedValue(mockPlatformCampaign);
    MockedDiscountsRepo.lockCampaignForUpdate.mockResolvedValue(mockPlatformCampaign);
    MockedDiscountsRepo.updateCampaign.mockResolvedValue(mockPlatformCampaign);

    const createdUsage: DiscountUsage = {
      id: 'usage-new-after-release',
      campaignId: mockPlatformCampaign.id,
      discountId: null,
      reservationId: null,
      bookingHoldId: null,
      customerAccountId,
      discountAmount: 20000,
      originalPrice: 100000,
      finalPrice: 80000,
      fundingSource: DiscountFundingSource.PLATFORM,
      status: DiscountUsageStatus.RESERVED,
      reservedAt: now,
      redeemedAt: null,
      releasedAt: null,
      releaseReason: null,
      expiresAt: new Date(now.getTime() + 15 * 60000),
      idempotencyKey: null,
      voucherCode: 'YALDA20',
      createdAt: now,
      updatedAt: now,
    };
    MockedDiscountsRepo.createDiscountUsage.mockResolvedValue(createdUsage);

    const reserved = await discountsStation.reserveDiscount(gamingCenterId, {
      stationId,
      basePrice,
      customerAccountId,
      code: 'YALDA20',
    });

    expect(reserved.status).toBe(DiscountUsageStatus.RESERVED);
    expect(reserved.id).toBe('usage-new-after-release');
  });

  // -------------------------------------------------------------
  // Scenario 15: Platform subsidy settlement protection
  // -------------------------------------------------------------
  it('Scenario 15: should protect gaming center settlement when platform discount is applied vs merchant discount', async () => {
    // Case A: Platform Funded Discount (40,000 Toman discount on 100,000 Toman order)
    const platformBreakdown = await calculateFinancialBreakdown(
      gamingCenterId,
      100000,
      40000,
      DiscountFundingSource.PLATFORM
    );

    expect(platformBreakdown.originalAmount).toBe(100000);
    expect(platformBreakdown.discountAmount).toBe(40000);
    expect(platformBreakdown.customerPayableAmount).toBe(60000); // Customer pays 60,000
    expect(platformBreakdown.platformFundedDiscount).toBe(40000);
    // Merchant payout is based on gross basePrice (100,000 - 5% commission = 95,000)
    expect(platformBreakdown.merchantPayoutAmount).toBe(95000);

    // Case B: Merchant Funded Discount (20,000 Toman discount on 100,000 Toman order)
    const merchantBreakdown = await calculateFinancialBreakdown(
      gamingCenterId,
      100000,
      20000,
      DiscountFundingSource.MERCHANT_FUNDED
    );

    expect(merchantBreakdown.originalAmount).toBe(100000);
    expect(merchantBreakdown.discountAmount).toBe(20000);
    expect(merchantBreakdown.customerPayableAmount).toBe(80000); // Customer pays 80,000
    expect(merchantBreakdown.merchantFundedDiscount).toBe(20000);
    // Merchant payout is based on discounted gross (80,000 - 5% commission on 100,000 = 75,000)
    expect(merchantBreakdown.merchantPayoutAmount).toBe(75000);
  });
});
