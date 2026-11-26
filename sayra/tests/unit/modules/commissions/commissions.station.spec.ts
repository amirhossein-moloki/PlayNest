import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { commissionsStation, getTargetPeriod } from '../../../../src/modules/commissions/commissions.station';
import {
  CommissionType,
  CommissionStatus,
  CommissionPaymentStatus,
  DiscountFundingSource,
  GamingCenterWalletTransactionType,
  ReservationSource,
  ReservationStatus,
  ReservationPaymentState,
  PaymentProvider,
  PaymentMethod,
} from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../../src/modules/audit/audit.station', () => ({
  auditService: {
    log: jest.fn().mockResolvedValue(true as never),
  },
}));

describe('commissionsStation Unit Tests', () => {
  const policyMock = prismaMock.commissionPolicy as any;
  const earningMock = prismaMock.earning as any;
  const resMock = prismaMock.reservation as any;
  const settingsMock = prismaMock.settings as any;
  const earningPaymentMock = prismaMock.earningPayment as any;
  const gcMock = prismaMock.gamingCenter as any;
  const gcTxMock = prismaMock.gamingCenterWalletTransaction as any;
  const platformSettingMock = (prismaMock as any).platformSetting;

  beforeEach(() => {
    (prismaMock.$executeRaw as any) = jest.fn().mockResolvedValue(1 as never);
    (prismaMock.$transaction as any) = jest.fn().mockImplementation(async (cb: any) => cb(prismaMock));
    gcMock.findUnique.mockResolvedValue({ id: 'gc-1', walletBalance: 0, reservedBalance: 0 });
    gcMock.update.mockResolvedValue({ id: 'gc-1' });
    gcTxMock.findUnique.mockResolvedValue(null);
    gcTxMock.create.mockImplementation(async ({ data }: any) => ({ id: 'gc-tx-1', ...data }));
  });

  describe('getTargetPeriod helper', () => {
    it('should format calendar month period according to site timezone', () => {
      const date = new Date('2026-10-15T12:00:00Z');
      expect(getTargetPeriod(date, 'Asia/Tehran')).toBe('2026-10');
      expect(getTargetPeriod(date, 'America/New_York')).toBe('2026-10');
    });

    it('should fallback to UTC for invalid timezone', () => {
      const date = new Date('2026-10-15T12:00:00Z');
      expect(getTargetPeriod(date, 'INVALID_TZ')).toBe('2026-10');
    });
  });

  describe('upsertPolicy', () => {
    it('should throw error if percentBps exceeds maxPercentBps', async () => {
      policyMock.findUnique.mockResolvedValue({ id: 'pol-1', maxPercentBps: 5000 });
      await expect(
        commissionsStation.upsertPolicy('gc-1', {
          type: CommissionType.PERCENT,
          percentBps: 6000,
          maxPercentBps: 5000,
        }, { id: 'usr-1', actorType: 'USER' as any })
      ).rejects.toThrow(AppError);
    });

    it('should save policy with monthlyTarget and maxPercentBps', async () => {
      policyMock.findUnique.mockResolvedValue(null);
      policyMock.upsert.mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: CommissionType.PERCENT,
        percentBps: 1000,
        monthlyTarget: 50,
        maxPercentBps: 10000,
      });

      const res = await commissionsStation.upsertPolicy('gc-1', {
        type: CommissionType.PERCENT,
        percentBps: 1000,
        monthlyTarget: 50,
      }, { id: 'usr-1', actorType: 'USER' as any });

      expect(res.monthlyTarget).toBe(50);
      expect(policyMock.upsert).toHaveBeenCalled();
    });
  });

  describe('getTargetProgress', () => {
    it('should calculate remaining count and target reached state correctly', async () => {
      policyMock.findUnique.mockResolvedValue({ monthlyTarget: 10 });
      settingsMock.findUnique.mockResolvedValue({ timeZone: 'UTC' });
      earningMock.count.mockResolvedValue(7);

      const progress = await commissionsStation.getTargetProgress('gc-1', '2026-10');

      expect(progress.monthlyTarget).toBe(10);
      expect(progress.paidReservationCount).toBe(7);
      expect(progress.remainingCount).toBe(3);
      expect(progress.isTargetReached).toBe(false);
    });

    it('should return isTargetReached = true when target reached or zero', async () => {
      policyMock.findUnique.mockResolvedValue({ monthlyTarget: 5 });
      settingsMock.findUnique.mockResolvedValue({ timeZone: 'UTC' });
      earningMock.count.mockResolvedValue(5);

      const progress = await commissionsStation.getTargetProgress('gc-1', '2026-10');

      expect(progress.remainingCount).toBe(0);
      expect(progress.isTargetReached).toBe(true);
    });
  });

  describe('calculateCommission', () => {
    it('should return existing earning idempotently on COMPLETED platform-paid reservation without double-crediting wallet', async () => {
      const existingEarning = {
        id: 'e-1',
        reservationId: 'res-1',
        gamingCenterId: 'gc-1',
        status: CommissionStatus.CHARGED,
        commissionAmount: 10000,
        currency: 'IRR',
      };
      resMock.findUnique.mockResolvedValue({
        id: 'res-1',
        gamingCenterId: 'gc-1',
        source: ReservationSource.ONLINE,
        status: ReservationStatus.COMPLETED,
        totalPrice: 100000,
        discountAmount: 0,
        originalAmount: 100000,
        paymentState: ReservationPaymentState.PAID,
        payments: [{ paidAt: new Date('2026-10-01T10:00:00Z'), provider: PaymentProvider.ZARINPAL, method: PaymentMethod.ONLINE }],
        groupBooking: null,
        earning: existingEarning,
      });
      policyMock.findUnique.mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: CommissionType.PERCENT,
        percentBps: 1000,
        isActive: true,
        applyToOnlineOnly: true,
      });
      // Wallet already credited previously
      gcTxMock.findUnique.mockResolvedValue({
        id: 'gc-tx-existing',
        idempotencyKey: 'reservation_settlement:res-1',
        amount: 90000,
      });

      const res = await commissionsStation.calculateCommission('res-1');
      expect(res).toEqual(existingEarning);
      expect(earningMock.create).not.toHaveBeenCalled();
      expect(gcMock.update).not.toHaveBeenCalled();
      expect(gcTxMock.create).not.toHaveBeenCalled();
    });

    it('should NOT deduct commission or credit wallet while paid reservation is still CONFIRMED or IN_PROGRESS', async () => {
      for (const status of [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.IN_PROGRESS]) {
        jest.clearAllMocks();
        (prismaMock.$transaction as any) = jest.fn().mockImplementation(async (cb: any) => cb(prismaMock));
        resMock.findUnique.mockResolvedValue({
          id: `res-${status}`,
          gamingCenterId: 'gc-1',
          source: ReservationSource.ONLINE,
          status,
          totalPrice: 100000,
          discountAmount: 0,
          originalAmount: 100000,
          paymentState: ReservationPaymentState.PAID,
          payments: [{ paidAt: new Date('2026-10-01T10:00:00Z'), provider: PaymentProvider.ZARINPAL, method: PaymentMethod.ONLINE }],
          groupBooking: null,
          earning: null,
        });

        const res = await commissionsStation.calculateCommission(`res-${status}`);
        expect(res).toBeNull();
        expect(earningMock.create).not.toHaveBeenCalled();
        expect(gcMock.update).not.toHaveBeenCalled();
        expect(gcTxMock.create).not.toHaveBeenCalled();
      }
    });

    it('should calculate commission ONCE at COMPLETED and credit net payout to GamingCenter wallet (platform-funded vs merchant-funded discount)', async () => {
      // Platform-funded discount: gross=100,000, discount=20,000, 10% commission=10,000 => net=90,000
      resMock.findUnique.mockResolvedValue({
        id: 'res-plat-disc',
        gamingCenterId: 'gc-1',
        source: ReservationSource.ONLINE,
        status: ReservationStatus.COMPLETED,
        completedAt: new Date('2026-10-01T12:00:00Z'),
        totalPrice: 80000,
        discountAmount: 20000,
        originalAmount: 100000,
        discountFundingSource: DiscountFundingSource.PLATFORM,
        paymentState: ReservationPaymentState.PAID,
        payments: [{ paidAt: new Date('2026-10-01T10:00:00Z'), provider: PaymentProvider.ZARINPAL, method: PaymentMethod.ONLINE }],
        groupBooking: null,
        earning: null,
      });

      policyMock.findUnique.mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: CommissionType.PERCENT,
        percentBps: 1000,
        currency: 'IRR',
        monthlyTarget: 10,
        applyToOnlineOnly: true,
        isActive: true,
      });

      settingsMock.findUnique.mockResolvedValue({ timeZone: 'UTC' });
      earningMock.findUnique.mockResolvedValue(null);
      earningMock.count.mockResolvedValue(4);
      earningMock.create.mockImplementation(async ({ data }: any) => ({ id: 'e-1', ...data }));
      earningPaymentMock.create.mockResolvedValue({ id: 'ep-1' });
      resMock.update.mockResolvedValue({ id: 'res-plat-disc' });

      const earning = await commissionsStation.calculateCommission('res-plat-disc');

      expect(earning?.baseAmount).toBe(100000);
      expect(earning?.commissionAmount).toBe(10000);
      expect(earning?.status).toBe(CommissionStatus.CHARGED);
      expect(resMock.update).toHaveBeenCalledWith({
        where: { id: 'res-plat-disc' },
        data: expect.objectContaining({ merchantPayoutAmount: 90000 }),
      });
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: { walletBalance: { increment: 90000 } },
      });
      expect(gcTxMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gamingCenterId: 'gc-1',
          type: GamingCenterWalletTransactionType.RESERVATION_SETTLEMENT,
          grossAmount: 100000,
          commissionAmount: 10000,
          amount: 90000,
          idempotencyKey: 'reservation_settlement:res-plat-disc',
        }),
      });

      // Merchant-funded discount: gross=100,000 - 20,000 = 80,000, 10% commission on base = 10,000 => net=70,000
      jest.clearAllMocks();
      (prismaMock.$executeRaw as any) = jest.fn().mockResolvedValue(1 as never);
      (prismaMock.$transaction as any) = jest.fn().mockImplementation(async (cb: any) => cb(prismaMock));
      gcMock.findUnique.mockResolvedValue({ id: 'gc-1', walletBalance: 90000, reservedBalance: 0 });
      gcMock.update.mockResolvedValue({ id: 'gc-1' });
      gcTxMock.findUnique.mockResolvedValue(null);
      gcTxMock.create.mockImplementation(async ({ data }: any) => ({ id: 'gc-tx-2', ...data }));
      resMock.findUnique.mockResolvedValue({
        id: 'res-merch-disc',
        gamingCenterId: 'gc-1',
        source: ReservationSource.ONLINE,
        status: ReservationStatus.COMPLETED,
        completedAt: new Date('2026-10-01T14:00:00Z'),
        totalPrice: 80000,
        discountAmount: 20000,
        originalAmount: 100000,
        discountFundingSource: DiscountFundingSource.MERCHANT_FUNDED,
        paymentState: ReservationPaymentState.PAID,
        payments: [{ paidAt: new Date('2026-10-01T12:00:00Z'), provider: PaymentProvider.ZARINPAL, method: PaymentMethod.ONLINE }],
        groupBooking: null,
        earning: null,
      });
      policyMock.findUnique.mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: CommissionType.PERCENT,
        percentBps: 1000,
        currency: 'IRR',
        monthlyTarget: null,
        applyToOnlineOnly: true,
        isActive: true,
      });
      earningMock.findUnique.mockResolvedValue(null);
      earningMock.create.mockImplementation(async ({ data }: any) => ({ id: 'e-m2', ...data }));

      await commissionsStation.calculateCommission('res-merch-disc');
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: { walletBalance: { increment: 70000 } },
      });
      expect(gcTxMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          grossAmount: 80000,
          commissionAmount: 10000,
          amount: 70000,
          idempotencyKey: 'reservation_settlement:res-merch-disc',
        }),
      });
    });

    it('should assign ZERO commission for reservations after target achievement and still credit full amount to wallet', async () => {
      resMock.findUnique.mockResolvedValue({
        id: 'res-2',
        gamingCenterId: 'gc-1',
        source: ReservationSource.ONLINE,
        status: ReservationStatus.COMPLETED,
        totalPrice: 10000,
        discountAmount: 0,
        paymentState: ReservationPaymentState.PAID,
        payments: [{ paidAt: new Date('2026-10-02T10:00:00Z'), provider: PaymentProvider.ZARINPAL }],
        groupBooking: null,
        earning: null,
      });

      policyMock.findUnique.mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: CommissionType.PERCENT,
        percentBps: 1000,
        monthlyTarget: 5,
        applyToOnlineOnly: true,
        isActive: true,
      });

      settingsMock.findUnique.mockResolvedValue({ timeZone: 'UTC' });
      earningMock.findUnique.mockResolvedValue(null);
      earningMock.count.mockResolvedValue(5);
      earningMock.create.mockImplementation(async ({ data }: any) => ({ id: 'e-2', ...data }));

      const earning = await commissionsStation.calculateCommission('res-2');

      expect(earning?.baseAmount).toBe(10000);
      expect(earning?.commissionAmount).toBe(0);
      expect(earning?.targetContribution).toBe(false);
      expect(earning?.targetReached).toBe(true);
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: { walletBalance: { increment: 10000 } },
      });
    });

    it('should enforce zero-target behavior immediately when monthlyTarget = 0', async () => {
      resMock.findUnique.mockResolvedValue({
        id: 'res-3',
        gamingCenterId: 'gc-1',
        source: ReservationSource.ONLINE,
        status: ReservationStatus.COMPLETED,
        totalPrice: 10000,
        discountAmount: 0,
        paymentState: ReservationPaymentState.PAID,
        payments: [{ paidAt: new Date('2026-10-02T10:00:00Z'), provider: PaymentProvider.ZARINPAL }],
        groupBooking: null,
        earning: null,
      });

      policyMock.findUnique.mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: CommissionType.PERCENT,
        percentBps: 1000,
        monthlyTarget: 0,
        applyToOnlineOnly: true,
        isActive: true,
      });

      settingsMock.findUnique.mockResolvedValue({ timeZone: 'UTC' });
      earningMock.findUnique.mockResolvedValue(null);
      earningMock.count.mockResolvedValue(0);
      earningMock.create.mockImplementation(async ({ data }: any) => ({ id: 'e-3', ...data }));

      const earning = await commissionsStation.calculateCommission('res-3');

      expect(earning?.commissionAmount).toBe(0);
      expect(earning?.targetReached).toBe(true);
      expect(earning?.targetContribution).toBe(false);
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: { walletBalance: { increment: 10000 } },
      });
    });

    it('should auto-settle (CHARGED) commission and credit GamingCenter wallet on COMPLETED full WALLET reservation', async () => {
      resMock.findUnique.mockResolvedValue({
        id: 'res-wallet-1',
        gamingCenterId: 'gc-1',
        source: ReservationSource.ONLINE,
        status: ReservationStatus.COMPLETED,
        totalPrice: 200000,
        discountAmount: 0,
        originalAmount: 200000,
        paymentState: ReservationPaymentState.PAID,
        payments: [
          {
            paidAt: new Date('2026-10-03T10:00:00Z'),
            provider: PaymentProvider.MANUAL,
            method: PaymentMethod.WALLET,
          },
        ],
        groupBooking: null,
        earning: null,
      });

      policyMock.findUnique.mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: CommissionType.PERCENT,
        percentBps: 500,
        currency: 'IRR',
        monthlyTarget: null,
        applyToOnlineOnly: true,
        isActive: true,
      });

      settingsMock.findUnique.mockResolvedValue({ timeZone: 'UTC' });
      earningMock.findUnique.mockResolvedValue(null);
      earningMock.create.mockImplementation(async ({ data }: any) => ({ id: 'e-w1', ...data }));
      earningPaymentMock.create.mockResolvedValue({ id: 'ep-w1' });
      resMock.update.mockResolvedValue({ id: 'res-wallet-1' });

      const earning = await commissionsStation.calculateCommission('res-wallet-1');

      expect(earning?.status).toBe(CommissionStatus.CHARGED);
      expect(earning?.commissionAmount).toBe(10000);
      expect(earningPaymentMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          earningId: 'e-w1',
          amount: 10000,
          status: CommissionPaymentStatus.PAID,
          referenceCode: 'AUTO_SETTLE_res-wallet-1',
        }),
      });
      expect(resMock.update).toHaveBeenCalledWith({
        where: { id: 'res-wallet-1' },
        data: expect.objectContaining({
          merchantPayoutAmount: 190000,
        }),
      });
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: { walletBalance: { increment: 190000 } },
      });
    });

    it('should NOT charge commission or credit GamingCenter wallet for in-person CASH or non-wallet MANUAL payments', async () => {
      for (const method of [PaymentMethod.CASH, PaymentMethod.ONLINE]) {
        jest.clearAllMocks();
        (prismaMock.$executeRaw as any) = jest.fn().mockResolvedValue(1 as never);
        (prismaMock.$transaction as any) = jest.fn().mockImplementation(async (cb: any) => cb(prismaMock));

        resMock.findUnique.mockResolvedValue({
          id: `res-man-${method}`,
          gamingCenterId: 'gc-1',
          source: ReservationSource.ONLINE,
          status: ReservationStatus.COMPLETED,
          totalPrice: 100000,
          discountAmount: 0,
          originalAmount: 100000,
          paymentState: ReservationPaymentState.PAID,
          payments: [
            {
              paidAt: new Date('2026-10-03T10:00:00Z'),
              provider: PaymentProvider.MANUAL,
              method,
            },
          ],
          groupBooking: null,
          earning: null,
        });

        const earning = await commissionsStation.calculateCommission(`res-man-${method}`);

        expect(earning).toBeNull();
        expect(earningMock.create).not.toHaveBeenCalled();
        expect(earningPaymentMock.create).not.toHaveBeenCalled();
        expect(gcMock.update).not.toHaveBeenCalled();
        expect(gcTxMock.create).not.toHaveBeenCalled();
      }
    });

    it('should auto-settle (CHARGED) commission and credit GamingCenter wallet for COMPLETED multi-station GroupBooking via groupBooking.payments', async () => {
      resMock.findUnique.mockResolvedValue({
        id: 'res-gb-child-1',
        gamingCenterId: 'gc-1',
        source: ReservationSource.ONLINE,
        status: ReservationStatus.COMPLETED,
        totalPrice: 300000,
        discountAmount: 0,
        originalAmount: 300000,
        paymentState: ReservationPaymentState.PAID,
        payments: [],
        groupBooking: {
          id: 'gb-1',
          payments: [
            {
              paidAt: new Date('2026-10-04T12:00:00Z'),
              provider: PaymentProvider.ZARINPAL,
              method: PaymentMethod.ONLINE,
            },
          ],
        },
        earning: null,
      });

      policyMock.findUnique.mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: CommissionType.PERCENT,
        percentBps: 1000,
        currency: 'IRR',
        monthlyTarget: null,
        applyToOnlineOnly: true,
        isActive: true,
      });

      settingsMock.findUnique.mockResolvedValue({ timeZone: 'UTC' });
      earningMock.findUnique.mockResolvedValue(null);
      earningMock.create.mockImplementation(async ({ data }: any) => ({ id: 'e-gb1', ...data }));
      earningPaymentMock.create.mockResolvedValue({ id: 'ep-gb1' });

      const earning = await commissionsStation.calculateCommission('res-gb-child-1');

      expect(earning?.status).toBe(CommissionStatus.CHARGED);
      expect(earning?.commissionAmount).toBe(30000);
      expect(earningPaymentMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          earningId: 'e-gb1',
          amount: 30000,
          status: CommissionPaymentStatus.PAID,
        }),
      });
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: { walletBalance: { increment: 270000 } },
      });
    });

    it('should auto-settle legacy PENDING earning and credit wallet when COMPLETED with platform payment', async () => {
      const existingPending = {
        id: 'e-pend-1',
        reservationId: 'res-late-1',
        gamingCenterId: 'gc-1',
        status: CommissionStatus.PENDING,
        commissionAmount: 15000,
        currency: 'IRR',
      };

      resMock.findUnique.mockResolvedValue({
        id: 'res-late-1',
        gamingCenterId: 'gc-1',
        source: ReservationSource.ONLINE,
        status: ReservationStatus.COMPLETED,
        totalPrice: 150000,
        discountAmount: 0,
        originalAmount: 150000,
        paymentState: ReservationPaymentState.PAID,
        payments: [
          {
            paidAt: new Date('2026-10-05T10:00:00Z'),
            provider: PaymentProvider.ZIBAL,
            method: PaymentMethod.ONLINE,
          },
        ],
        groupBooking: null,
        earning: existingPending,
      });
      policyMock.findUnique.mockResolvedValue(null);

      earningMock.updateMany.mockResolvedValue({ count: 1 });
      earningMock.findUnique.mockResolvedValue({
        ...existingPending,
        status: CommissionStatus.CHARGED,
      });
      earningPaymentMock.findMany.mockResolvedValue([]);
      earningPaymentMock.create.mockResolvedValue({ id: 'ep-late-1' });

      const res = await commissionsStation.calculateCommission('res-late-1');

      expect(res?.status).toBe(CommissionStatus.CHARGED);
      expect(earningMock.updateMany).toHaveBeenCalledWith({
        where: { id: 'e-pend-1', gamingCenterId: 'gc-1' },
        data: expect.objectContaining({ status: CommissionStatus.CHARGED }),
      });
      expect(earningPaymentMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          earningId: 'e-pend-1',
          amount: 15000,
          status: CommissionPaymentStatus.PAID,
        }),
      });
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: { walletBalance: { increment: 135000 } },
      });
    });

    it('should fall back to PlatformSetting when no center policy exists, and still credit full gross to wallet when center policy is inactive', async () => {
      resMock.findUnique.mockResolvedValue({
        id: 'res-def-1',
        gamingCenterId: 'gc-no-pol',
        source: ReservationSource.ONLINE,
        status: ReservationStatus.COMPLETED,
        totalPrice: 200000,
        discountAmount: 0,
        originalAmount: 200000,
        paymentState: ReservationPaymentState.PAID,
        payments: [{ paidAt: new Date('2026-10-06T10:00:00Z'), provider: PaymentProvider.ZARINPAL }],
        groupBooking: null,
        earning: null,
      });
      gcMock.findUnique.mockResolvedValue({ id: 'gc-no-pol', walletBalance: 0, reservedBalance: 0 });
      policyMock.findUnique.mockResolvedValue(null);
      platformSettingMock.findUnique.mockResolvedValue({ platformCommissionPercent: 6.5 });
      settingsMock.findUnique.mockResolvedValue({ timeZone: 'UTC' });
      earningMock.create.mockImplementation(async ({ data }: any) => ({ id: 'e-def-1', ...data }));
      earningPaymentMock.create.mockResolvedValue({ id: 'ep-def-1' });

      const earning = await commissionsStation.calculateCommission('res-def-1');

      expect(earning?.percentBps).toBe(650);
      expect(earning?.commissionAmount).toBe(13000);
      expect(earning?.status).toBe(CommissionStatus.CHARGED);
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-no-pol' },
        data: { walletBalance: { increment: 187000 } },
      });

      // Inactive center policy: NO Earning created (0 commission), but FULL gross (100000) STILL credited to wallet!
      jest.clearAllMocks();
      (prismaMock.$executeRaw as any) = jest.fn().mockResolvedValue(1 as never);
      (prismaMock.$transaction as any) = jest.fn().mockImplementation(async (cb: any) => cb(prismaMock));
      gcMock.findUnique.mockResolvedValue({ id: 'gc-opted-out', walletBalance: 0, reservedBalance: 0 });
      gcMock.update.mockResolvedValue({ id: 'gc-opted-out' });
      gcTxMock.findUnique.mockResolvedValue(null);
      gcTxMock.create.mockImplementation(async ({ data }: any) => ({ id: 'gc-tx-opt', ...data }));
      resMock.findUnique.mockResolvedValue({
        id: 'res-opted-out',
        gamingCenterId: 'gc-opted-out',
        source: ReservationSource.ONLINE,
        status: ReservationStatus.COMPLETED,
        totalPrice: 100000,
        discountAmount: 0,
        originalAmount: 100000,
        paymentState: ReservationPaymentState.PAID,
        payments: [{ paidAt: new Date('2026-10-06T10:00:00Z'), provider: PaymentProvider.ZARINPAL }],
        groupBooking: null,
        earning: null,
      });
      policyMock.findUnique.mockResolvedValue({
        id: 'pol-inactive',
        gamingCenterId: 'gc-opted-out',
        isActive: false,
      });
      const optOutResult = await commissionsStation.calculateCommission('res-opted-out');
      expect(optOutResult).toBeNull();
      expect(earningMock.create).not.toHaveBeenCalled();
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-opted-out' },
        data: { walletBalance: { increment: 100000 } },
      });
      expect(gcTxMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gamingCenterId: 'gc-opted-out',
          grossAmount: 100000,
          commissionAmount: 0,
          amount: 100000,
          idempotencyKey: 'reservation_settlement:res-opted-out',
        }),
      });
    });

    it('should skip commission and wallet settlement for CANCELED, EXPIRED, or REFUNDED reservations', async () => {
      for (const state of [
        { status: ReservationStatus.CANCELED, paymentState: ReservationPaymentState.UNPAID },
        { status: ReservationStatus.EXPIRED, paymentState: ReservationPaymentState.UNPAID },
        { status: ReservationStatus.CONFIRMED, paymentState: ReservationPaymentState.REFUNDED },
      ]) {
        resMock.findUnique.mockResolvedValue({
          id: 'res-skip',
          gamingCenterId: 'gc-1',
          source: ReservationSource.ONLINE,
          ...state,
          earning: null,
        });

        const res = await commissionsStation.calculateCommission('res-skip');
        expect(res).toBeNull();
        expect(earningMock.create).not.toHaveBeenCalled();
        expect(gcTxMock.create).not.toHaveBeenCalled();
      }
    });
  });

  describe('reverseCommissionForReservation', () => {
    it('should mark CHARGED earning as REFUNDED, clear targetContribution, and refund PAID EarningPayments', async () => {
      earningMock.findUnique
        .mockResolvedValueOnce({
          id: 'e-rev-1',
          reservationId: 'res-rev-1',
          gamingCenterId: 'gc-1',
          status: CommissionStatus.CHARGED,
          targetContribution: true,
          payments: [{ id: 'ep-1', status: CommissionPaymentStatus.PAID }],
        })
        .mockResolvedValueOnce({
          id: 'e-rev-1',
          reservationId: 'res-rev-1',
          gamingCenterId: 'gc-1',
          status: CommissionStatus.REFUNDED,
          targetContribution: false,
        });
      earningMock.updateMany.mockResolvedValue({ count: 1 });
      earningPaymentMock.updateMany.mockResolvedValue({ count: 1 });

      const updated = await commissionsStation.reverseCommissionForReservation('res-rev-1', {
        reason: 'Customer canceled',
      });

      expect(updated?.status).toBe(CommissionStatus.REFUNDED);
      expect(updated?.targetContribution).toBe(false);
      expect(earningMock.updateMany).toHaveBeenCalledWith({
        where: { id: 'e-rev-1', gamingCenterId: 'gc-1' },
        data: {
          status: CommissionStatus.REFUNDED,
          targetContribution: false,
          note: 'Customer canceled',
        },
      });
      expect(earningPaymentMock.updateMany).toHaveBeenCalledWith({
        where: { earningId: 'e-rev-1', status: CommissionPaymentStatus.PAID },
        data: { status: CommissionPaymentStatus.REFUNDED },
      });
    });

    it('should reverse both Earning and GamingCenterWalletTransaction (SETTLEMENT_REVERSAL) on post-completion refund', async () => {
      earningMock.findUnique
        .mockResolvedValueOnce({
          id: 'e-rev-wal',
          reservationId: 'res-rev-wal',
          gamingCenterId: 'gc-1',
          status: CommissionStatus.CHARGED,
          targetContribution: true,
          payments: [{ id: 'ep-wal', status: CommissionPaymentStatus.PAID }],
        })
        .mockResolvedValueOnce({
          id: 'e-rev-wal',
          reservationId: 'res-rev-wal',
          gamingCenterId: 'gc-1',
          status: CommissionStatus.REFUNDED,
          targetContribution: false,
        });
      earningMock.updateMany.mockResolvedValue({ count: 1 });
      earningPaymentMock.updateMany.mockResolvedValue({ count: 1 });
      gcTxMock.findUnique
        .mockResolvedValueOnce({
          id: 'gc-tx-orig',
          gamingCenterId: 'gc-1',
          grossAmount: 100000,
          commissionAmount: 10000,
          amount: 90000,
          currency: 'IRR',
          earningId: 'e-rev-wal',
        })
        .mockResolvedValueOnce(null);
      gcMock.findUnique.mockResolvedValue({
        id: 'gc-1',
        walletBalance: 90000,
        reservedBalance: 0,
      });

      await commissionsStation.reverseCommissionForReservation('res-rev-wal', {
        reason: 'Full refund after completion',
      });

      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: { walletBalance: { decrement: 90000 } },
      });
      expect(gcTxMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gamingCenterId: 'gc-1',
          type: GamingCenterWalletTransactionType.SETTLEMENT_REVERSAL,
          grossAmount: -100000,
          commissionAmount: -10000,
          amount: -90000,
          idempotencyKey: 'reservation_settlement_reversal:res-rev-wal',
        }),
      });
    });

    it('should mark PENDING earning as WAIVED, void PENDING EarningPayments, and be idempotent', async () => {
      earningMock.findUnique
        .mockResolvedValueOnce({
          id: 'e-rev-2',
          reservationId: 'res-rev-2',
          gamingCenterId: 'gc-1',
          status: CommissionStatus.PENDING,
          targetContribution: true,
          payments: [],
        })
        .mockResolvedValueOnce({
          id: 'e-rev-2',
          reservationId: 'res-rev-2',
          gamingCenterId: 'gc-1',
          status: CommissionStatus.WAIVED,
          targetContribution: false,
        });
      earningMock.updateMany.mockResolvedValue({ count: 1 });
      earningPaymentMock.updateMany.mockResolvedValue({ count: 0 });

      const updated = await commissionsStation.reverseCommissionForReservation('res-rev-2');
      expect(updated?.status).toBe(CommissionStatus.WAIVED);
      expect(earningPaymentMock.updateMany).toHaveBeenCalledWith({
        where: { earningId: 'e-rev-2', status: CommissionPaymentStatus.PENDING },
        data: { status: CommissionPaymentStatus.VOID },
      });

      // Second call on already WAIVED earning is a no-op
      jest.clearAllMocks();
      (prismaMock.$transaction as any) = jest.fn().mockImplementation(async (cb: any) => cb(prismaMock));
      earningMock.findUnique.mockResolvedValue({
        id: 'e-rev-2',
        status: CommissionStatus.WAIVED,
      });
      const repeat = await commissionsStation.reverseCommissionForReservation('res-rev-2');
      expect(repeat?.status).toBe(CommissionStatus.WAIVED);
      expect(earningMock.updateMany).not.toHaveBeenCalled();

      // Missing earning returns null
      earningMock.findUnique.mockResolvedValue(null);
      expect(await commissionsStation.reverseCommissionForReservation('res-none')).toBeNull();
    });
  });

  describe('payCommission & waiveCommission guards', () => {
    it('should reject payCommission for CHARGED, REFUNDED, or WAIVED commissions with 409', async () => {
      for (const status of [
        CommissionStatus.CHARGED,
        CommissionStatus.REFUNDED,
        CommissionStatus.WAIVED,
      ]) {
        earningMock.findFirst.mockResolvedValue({
          id: 'e-1',
          gamingCenterId: 'gc-1',
          status,
          currency: 'IRR',
          commissionAmount: 5000,
        });

        await expect(
          commissionsStation.payCommission(
            'e-1',
            'gc-1',
            { amount: 5000, currency: 'IRR', status: CommissionPaymentStatus.PAID },
            { id: 'pa-1', actorType: 'PLATFORM_ADMIN' as any }
          )
        ).rejects.toThrow(AppError);
      }
    });

    it('should waive PENDING commission and reject CHARGED/REFUNDED/WAIVED commissions', async () => {
      earningMock.findFirst.mockResolvedValue({
        id: 'e-pend',
        gamingCenterId: 'gc-1',
        status: CommissionStatus.PENDING,
        commissionAmount: 5000,
      });
      earningMock.updateMany.mockResolvedValue({ count: 1 });
      earningMock.findUnique.mockResolvedValue({
        id: 'e-pend',
        gamingCenterId: 'gc-1',
        status: CommissionStatus.WAIVED,
        targetContribution: false,
      });
      earningPaymentMock.updateMany.mockResolvedValue({ count: 0 });

      const waived = await commissionsStation.waiveCommission(
        'e-pend',
        'gc-1',
        { reason: 'Partner waiver' },
        { id: 'pa-1', actorType: 'PLATFORM_ADMIN' as any }
      );
      expect(waived.status).toBe(CommissionStatus.WAIVED);

      earningMock.findFirst.mockResolvedValue({
        id: 'e-charged',
        gamingCenterId: 'gc-1',
        status: CommissionStatus.CHARGED,
      });
      await expect(
        commissionsStation.waiveCommission(
          'e-charged',
          'gc-1',
          {},
          { id: 'pa-1', actorType: 'PLATFORM_ADMIN' as any }
        )
      ).rejects.toThrow(AppError);
    });
  });
});
