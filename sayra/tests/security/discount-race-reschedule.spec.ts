/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  DiscountFundingSource,
  DiscountTargetType,
  DiscountUsageStatus,
  DiscountValueType,
  ReservationPaymentState,
  ReservationSource,
  ReservationStatus,
  SessionActorType,
} from '@prisma/client';
import { discountsStation } from '../../src/modules/discounts/discounts.station';
import { DiscountsRepo } from '../../src/modules/discounts/discounts.repo';
import { ReservationRepo } from '../../src/modules/reservation/reservation.repo';
import { reservationStation } from '../../src/modules/reservation/reservation.station';
import { AuthRepository } from '../../src/modules/auth/auth.repository';
import { prisma } from '../../src/config/prisma';
import AppError from '../../src/common/errors/AppError';

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    discountUsage: { count: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() },
    reservation: { count: jest.fn() },
    commissionPolicy: { findFirst: jest.fn() },
    platformSetting: { findFirst: jest.fn() },
    gamingCenter: { findUnique: jest.fn() },
    extraController: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

describe('SEC-018: Discount Concurrency Races, Quota Error Propagation & Paid Reschedule Guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.commissionPolicy.findFirst as jest.Mock).mockImplementation((() =>
      Promise.resolve({ id: 'pol-1', platformCommissionPercent: 10, fixedFee: 0, isDefault: true })) as any);
    (prisma.gamingCenter.findUnique as jest.Mock).mockImplementation((() =>
      Promise.resolve({ id: 'gc-1', commissionRate: 10 })) as any);
    ((prisma as any).extraController.findMany as jest.Mock).mockImplementation((() => Promise.resolve([])) as any);
  });

  it('reserveDiscount locks campaign FOR UPDATE and rejects post-lock per-user quota exhaustion using atomic increment', async () => {
    const campaign = {
      id: 'camp-1',
      gamingCenterId: 'gc-1',
      name: 'Promo',
      title: 'Promo',
      code: 'SAVE20',
      isActive: true,
      status: 'ACTIVE',
      deletedAt: null,
      startAt: new Date(Date.now() - 60000),
      endAt: new Date(Date.now() + 3600000),
      targetType: DiscountTargetType.GAMING_CENTER,
      targetId: 'gc-1',
      targetAudience: 'ALL',
      specificUserIds: [],
      applicableGamecenterIds: [],
      applicableDeviceTypes: [],
      applicableStationIds: [],
      valueType: DiscountValueType.FIXED_AMOUNT,
      value: 20000,
      discountType: DiscountValueType.FIXED_AMOUNT,
      discountValue: 20000,
      maxDiscountAmount: null,
      minOrderAmount: null,
      minReservationAmount: null,
      fundingSource: DiscountFundingSource.MERCHANT_FUNDED,
      totalUsageLimit: 50,
      maxUsageCount: 50,
      currentUsageCount: 1,
      totalBudget: 1000000,
      usedBudget: 20000,
      maxUsagePerUser: 1,
      minCompletedReservations: null,
      activeDays: [],
      activeStartHour: null,
      activeEndHour: null,
    };

    const txMock: any = {
      discountUsage: { updateMany: jest.fn(), findFirst: jest.fn() },
    };

    const lockSpy = jest
      .spyOn(DiscountsRepo, 'lockCampaignForUpdate')
      .mockResolvedValue(campaign as any);
    jest.spyOn(DiscountsRepo, 'findCampaignById').mockResolvedValue(campaign as any);
    jest.spyOn(DiscountsRepo, 'findActiveApplicableDiscounts').mockResolvedValue([]);
    jest.spyOn(DiscountsRepo, 'findActiveApplicableCampaigns').mockResolvedValue([]);
    const updateSpy = jest
      .spyOn(DiscountsRepo, 'updateCampaign')
      .mockResolvedValue(campaign as any);
    jest.spyOn(DiscountsRepo, 'createDiscountUsage').mockResolvedValue({ id: 'du-1' } as any);

    // Case A: Under lock, user usage count jumped from 0 to 1 -> rejected with 409!
    let countCall = 0;
    jest.spyOn(DiscountsRepo, 'countUserCampaignUsages').mockImplementation(async () => {
      countCall += 1;
      return countCall === 1 ? 0 : 1;
    });

    await expect(
      discountsStation.reserveDiscount(
        'gc-1',
        {
          stationId: 'st-1',
          basePrice: 100000,
          selectedDiscountId: 'camp-1',
          selectedType: 'CAMPAIGN',
          customerAccountId: 'cust-1',
        },
        undefined,
        txMock
      )
    ).rejects.toThrow();
    expect(lockSpy).toHaveBeenCalledWith('camp-1', txMock);
    expect(updateSpy).not.toHaveBeenCalled();

    // Case B: Under lock, user still eligible -> uses atomic { increment }
    jest.spyOn(DiscountsRepo, 'countUserCampaignUsages').mockResolvedValue(0);
    await discountsStation.reserveDiscount(
      'gc-1',
      {
        stationId: 'st-1',
        basePrice: 100000,
        selectedDiscountId: 'camp-1',
        selectedType: 'CAMPAIGN',
        customerAccountId: 'cust-1',
      },
      undefined,
      txMock
    );
    expect(updateSpy).toHaveBeenCalledWith(
      'camp-1',
      {
        usedBudget: { increment: 20000 },
        currentUsageCount: { increment: 1 },
      },
      txMock
    );
  });

  it('consumeCampaignDiscount locks FOR UPDATE and rejects exhausted campaign budget/count', async () => {
    const txMock: any = {
      discountUsage: {
        findFirst: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue(null),
      },
    };
    const lockSpy = jest.spyOn(DiscountsRepo, 'lockCampaignForUpdate').mockResolvedValue({
      id: 'camp-1',
      totalUsageLimit: 10,
      maxUsageCount: 10,
      currentUsageCount: 10,
      totalBudget: 500000,
      usedBudget: 100000,
      maxUsagePerUser: null,
    } as any);
    const updateSpy = jest.spyOn(DiscountsRepo, 'updateCampaign');

    await expect(
      discountsStation.consumeCampaignDiscount(
        'camp-1',
        'res-1',
        'cust-1',
        20000,
        DiscountFundingSource.MERCHANT_FUNDED,
        txMock
      )
    ).rejects.toThrow(/تکمیل شده/);
    expect(lockSpy).toHaveBeenCalledWith('camp-1', txMock);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('releaseDiscount uses CAS updateMany and avoids double-decrementing campaign counters on lost race', async () => {
    const usage = {
      id: 'du-race-1',
      campaignId: 'camp-1',
      status: DiscountUsageStatus.RESERVED,
      discountAmount: 25000,
    };
    jest.spyOn(DiscountsRepo, 'findUsageById').mockResolvedValue(usage as any);
    const lockSpy = jest.spyOn(DiscountsRepo, 'lockCampaignForUpdate');
    const updateCampaignSpy = jest.spyOn(DiscountsRepo, 'updateCampaign');

    const txMock: any = {
      discountUsage: {
        updateMany: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue({ count: 0 }),
      },
    };

    await discountsStation.releaseDiscount({ usageId: 'du-race-1' }, txMock);
    expect(txMock.discountUsage.updateMany).toHaveBeenCalled();
    expect(lockSpy).not.toHaveBeenCalled();
    expect(updateCampaignSpy).not.toHaveBeenCalled();
  });

  it('createPublicReservation propagates discount quota failure instead of swallowing it', async () => {
    const center = {
      id: 'gc-1',
      slug: 'center-1',
      name: 'Center 1',
      isActive: true,
      verificationStatus: 'APPROVED',
      openingTime: '00:00',
      closingTime: '23:59',
      timezone: 'UTC',
      closedDays: [],
      settings: {
        allowOnlineBooking: true,
        requireOtpForPublicBooking: false,
        minAdvanceBookingMinutes: 0,
        timeZone: 'UTC',
        preventOverlaps: true,
        workStartTime: '00:00',
        workEndTime: '23:59',
        reservationConfirmationTimeoutMinutes: 30,
        autoReleaseUnpaidMinutes: 15,
      },
      schedules: [],
      closures: [],
    };
    const station = {
      id: 'st-1',
      name: 'Standard PS5',
      hourlyPrice: 100000,
      defaultDurationHours: 1,
      stationType: 'PS5',
      isActive: true,
      gamingCenterId: 'gc-1',
    };
    const custAcct = {
      id: 'cust-1',
      phone: '09123456789',
      walletBalance: 0,
      reservedBalance: 0,
    };
    const txMock: any = {
      user: {
        findFirst: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue({ id: 'staff-1' }),
      },
      customerAccount: {
        findFirst: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue(custAcct),
        findUnique: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue(custAcct),
        upsert: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue(custAcct),
        create: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue(custAcct),
      },
      customerProfile: {
        findFirst: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue({ id: 'prof-1' }),
        findUnique: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue({ id: 'prof-1' }),
        upsert: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue({ id: 'prof-1' }),
        create: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue({ id: 'prof-1' }),
      },
      extraController: {
        findMany: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue([]),
      },
    };

    jest.spyOn(ReservationRepo, 'findGamingCenterBySlugWithSettings').mockResolvedValue(center as any);
    jest.spyOn(ReservationRepo, 'transaction').mockImplementation(async (cb: any) => cb(txMock));
    jest.spyOn(AuthRepository, 'findRecentConsumedOtp').mockResolvedValue({ id: 'otp-1' } as any);
    jest.spyOn(ReservationRepo, 'lockStationForUpdate').mockResolvedValue(undefined as any);
    jest.spyOn(ReservationRepo, 'findStation').mockResolvedValue(station as any);
    jest.spyOn(ReservationRepo, 'findOverlappingMaintenance').mockResolvedValue([]);
    jest.spyOn(ReservationRepo, 'findStaffShift').mockResolvedValue({
      dayOfWeek: new Date().getUTCDay(),
      startTime: '00:00',
      endTime: '23:59',
      isActive: true,
    } as any);
    jest.spyOn(ReservationRepo, 'findOverlappingReservation').mockResolvedValue(null);
    jest.spyOn(ReservationRepo, 'assertActiveReservationLimitNotExceeded').mockResolvedValue(undefined as any);
    jest.spyOn(ReservationRepo, 'createReservation').mockResolvedValue({
      id: 'res-new-1',
      gamingCenterId: 'gc-1',
      paymentState: ReservationPaymentState.UNPAID,
      status: ReservationStatus.PENDING,
    } as any);

    jest.spyOn(discountsStation, 'calculateDiscountSelection').mockResolvedValue({
      isValid: true,
      originalAmount: 100000,
      discountAmount: 20000,
      customerPayableAmount: 80000,
      platformFundedDiscount: 0,
      merchantPayoutAmount: 72000,
      discountFundingSource: DiscountFundingSource.MERCHANT_FUNDED,
      campaignId: 'camp-1',
      discountId: null,
      voucherCode: 'SAVE20',
      appliedDiscount: null,
      betterDiscountAvailable: false,
      betterDiscount: null,
    } as any);
    jest
      .spyOn(discountsStation, 'reserveDiscount')
      .mockRejectedValue(new AppError('Campaign limit exceeded', 409, { code: 'CAMPAIGN_LIMIT_EXCEEDED' }));

    const futureStart = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
    await expect(
      reservationStation.createPublicReservation('center-1', {
        stationId: 'st-1',
        startTime: futureStart,
        customer: { fullName: 'Ali', phone: '09123456789' },
        voucherCode: 'SAVE20',
      } as any)
    ).rejects.toThrow(/Campaign limit exceeded/i);
  });

  it('rescheduleReservation blocks CUSTOMER switching a PAID reservation to another/VIP station or pricier slot', async () => {
    const startAt = new Date(Date.now() + 24 * 3600 * 1000);
    const baseReservation = {
      id: 'res-paid-1',
      gamingCenterId: 'gc-1',
      stationId: 'st-standard',
      staffId: null,
      customerAccountId: 'cust-1',
      status: ReservationStatus.CONFIRMED,
      paymentState: ReservationPaymentState.PAID,
      source: ReservationSource.ONLINE,
      totalHours: 1,
      totalPrice: 100000,
      customerPayableAmount: 100000,
      voucherCode: null,
    };

    jest.spyOn(ReservationRepo, 'transaction').mockImplementation(async (cb: any) => cb({}));
    jest.spyOn(ReservationRepo, 'findReservationById').mockResolvedValue(baseReservation as any);
    jest.spyOn(ReservationRepo, 'lockStationForUpdate').mockResolvedValue(undefined as any);
    jest.spyOn(ReservationRepo, 'findStation').mockResolvedValue({
      id: 'st-vip',
      name: 'VIP Room',
      hourlyPrice: 400000,
      defaultDurationHours: 1,
      stationType: 'VIP',
      isActive: true,
    } as any);

    await expect(
      reservationStation.rescheduleReservation(
        'res-paid-1',
        'gc-1',
        {
          startTime: startAt.toISOString(),
          stationId: 'st-vip',
        },
        { id: 'cust-1', actorType: SessionActorType.CUSTOMER }
      )
    ).rejects.toThrow(/Cannot change game station on an already paid reservation/i);
  });
});
