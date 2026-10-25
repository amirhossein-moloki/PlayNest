import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { commissionsStation, getTargetPeriod } from '../../../../src/modules/commissions/commissions.station';
import { CommissionType, ReservationSource, ReservationPaymentState, PaymentProvider } from '@prisma/client';
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

  beforeEach(() => {
    (prismaMock.$executeRaw as any) = jest.fn().mockResolvedValue(1 as never);
    (prismaMock.$transaction as any) = jest.fn().mockImplementation(async (cb: any) => cb(prismaMock));
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
    it('should return existing earning if already calculated (idempotency)', async () => {
      const existingEarning = { id: 'e-1', commissionAmount: 100 };
      resMock.findUnique.mockResolvedValue({
        id: 'res-1',
        earning: existingEarning,
      });

      const res = await commissionsStation.calculateCommission('res-1');
      expect(res).toEqual(existingEarning);
    });

    it('should calculate commission from base price BEFORE discount', async () => {
      // totalPrice = 8000, discountAmount = 2000 => basePrice = 10000
      // percentBps = 1000 (10%) => commission = 1000
      resMock.findUnique.mockResolvedValue({
        id: 'res-1',
        gamingCenterId: 'gc-1',
        source: ReservationSource.ONLINE,
        totalPrice: 8000,
        discountAmount: 2000,
        paymentState: ReservationPaymentState.PAID,
        payments: [{ paidAt: new Date('2026-10-01T10:00:00Z'), provider: PaymentProvider.ZARINPAL }],
        earning: null,
      });

      policyMock.findUnique.mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: CommissionType.PERCENT,
        percentBps: 1000, // 10%
        monthlyTarget: 10,
        applyToOnlineOnly: true,
        isActive: true,
      });

      settingsMock.findUnique.mockResolvedValue({ timeZone: 'UTC' });
      earningMock.findUnique.mockResolvedValue(null);
      earningMock.count.mockResolvedValue(4); // 4 prior contributions (< 10)
      earningMock.create.mockImplementation(async ({ data }: any) => ({ id: 'e-1', ...data }));
      earningPaymentMock.create.mockResolvedValue({ id: 'ep-1' });

      const earning = await commissionsStation.calculateCommission('res-1');

      expect(earning?.baseAmount).toBe(10000); // 8000 + 2000
      expect(earning?.commissionAmount).toBe(1000); // 10% of 10000
      expect(earning?.targetContribution).toBe(true);
      expect(earning?.targetReached).toBe(false);
    });

    it('should assign ZERO commission for reservations after target achievement', async () => {
      resMock.findUnique.mockResolvedValue({
        id: 'res-2',
        gamingCenterId: 'gc-1',
        source: ReservationSource.ONLINE,
        totalPrice: 10000,
        discountAmount: 0,
        paymentState: ReservationPaymentState.PAID,
        payments: [{ paidAt: new Date('2026-10-02T10:00:00Z'), provider: PaymentProvider.ZARINPAL }],
        earning: null,
      });

      policyMock.findUnique.mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: CommissionType.PERCENT,
        percentBps: 1000, // 10%
        monthlyTarget: 5,
        applyToOnlineOnly: true,
        isActive: true,
      });

      settingsMock.findUnique.mockResolvedValue({ timeZone: 'UTC' });
      earningMock.findUnique.mockResolvedValue(null);
      earningMock.count.mockResolvedValue(5); // target of 5 already reached
      earningMock.create.mockImplementation(async ({ data }: any) => ({ id: 'e-2', ...data }));

      const earning = await commissionsStation.calculateCommission('res-2');

      expect(earning?.baseAmount).toBe(10000);
      expect(earning?.commissionAmount).toBe(0);
      expect(earning?.targetContribution).toBe(false);
      expect(earning?.targetReached).toBe(true);
    });

    it('should enforce zero-target behavior immediately when monthlyTarget = 0', async () => {
      resMock.findUnique.mockResolvedValue({
        id: 'res-3',
        gamingCenterId: 'gc-1',
        source: ReservationSource.ONLINE,
        totalPrice: 10000,
        discountAmount: 0,
        paymentState: ReservationPaymentState.PAID,
        payments: [{ paidAt: new Date('2026-10-02T10:00:00Z'), provider: PaymentProvider.ZARINPAL }],
        earning: null,
      });

      policyMock.findUnique.mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: CommissionType.PERCENT,
        percentBps: 1000,
        monthlyTarget: 0, // Target is 0
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
    });
  });
});
