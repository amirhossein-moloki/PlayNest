import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { CommissionsRepo } from '../../../../src/modules/commissions/commissions.repo';
import { CommissionType, CommissionStatus, CommissionPaymentStatus } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('CommissionsRepo', () => {
  const policyMock = prismaMock.commissionPolicy /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const earningMock = prismaMock.earning /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const paymentMock = prismaMock.earningPayment /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const resMock = prismaMock.reservation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const platformSettingMock = (prismaMock as any).platformSetting;

  describe('Policy operations', () => {
    it('findPolicyByGamingCenterId', async () => {
      policyMock.findUnique.mockResolvedValue({ id: 'pol-1' });
      await CommissionsRepo.findPolicyByGamingCenterId('gc-1');
      expect(policyMock.findUnique).toHaveBeenCalledWith({ where: { gamingCenterId: 'gc-1' } });
    });

    it('findPlatformDefaultCommissionPercent', async () => {
      platformSettingMock.findUnique.mockResolvedValue({ platformCommissionPercent: 6.5 });
      const percent = await CommissionsRepo.findPlatformDefaultCommissionPercent();
      expect(percent).toBe(6.5);
      expect(platformSettingMock.findUnique).toHaveBeenCalledWith({
        where: { id: 'default' },
        select: { platformCommissionPercent: true },
      });
    });

    it('ensureDefaultPolicyForGamingCenter uses PlatformSetting.platformCommissionPercent', async () => {
      platformSettingMock.findUnique.mockResolvedValue({ platformCommissionPercent: 7.5 });
      policyMock.upsert.mockResolvedValue({ id: 'pol-def', gamingCenterId: 'gc-1', percentBps: 750 });

      const policy = await CommissionsRepo.ensureDefaultPolicyForGamingCenter('gc-1');

      expect(policy?.percentBps).toBe(750);
      expect(policyMock.upsert).toHaveBeenCalledWith({
        where: { gamingCenterId: 'gc-1' },
        create: {
          gamingCenterId: 'gc-1',
          type: CommissionType.PERCENT,
          percentBps: 750,
          currency: 'IRR',
          applyToOnlineOnly: true,
          isActive: true,
        },
        update: {},
      });
    });

    it('upsertPolicy', async () => {
      const data = { type: CommissionType.PERCENT, percentBps: 250 } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
      policyMock.upsert.mockResolvedValue({ id: 'pol-1', ...data });
      await CommissionsRepo.upsertPolicy('gc-1', data);
      expect(policyMock.upsert).toHaveBeenCalledWith({
        where: { gamingCenterId: 'gc-1' },
        create: data,
        update: data
      });
    });
  });

  describe('Earning operations', () => {
    it('findEarning', async () => {
      earningMock.findUnique.mockResolvedValue({ id: 'e-1' });
      await CommissionsRepo.findEarning('res-1');
      expect(earningMock.findUnique).toHaveBeenCalledWith({ where: { reservationId: 'res-1' } });
    });

    it('countTargetContributions excludes REFUNDED and WAIVED earnings', async () => {
      earningMock.count.mockResolvedValue(3);
      const count = await CommissionsRepo.countTargetContributions('gc-1', '2026-10');
      expect(count).toBe(3);
      expect(earningMock.count).toHaveBeenCalledWith({
        where: {
          gamingCenterId: 'gc-1',
          targetPeriod: '2026-10',
          targetContribution: true,
          status: {
            notIn: [CommissionStatus.REFUNDED, CommissionStatus.WAIVED],
          },
        },
      });
    });

    it('createEarning', async () => {
      const data = { reservationId: 'res-1', gamingCenterId: 'gc-1', baseAmount: 1000, commissionAmount: 25, type: CommissionType.PERCENT } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
      earningMock.create.mockResolvedValue({ id: 'e-1', ...data });
      await CommissionsRepo.createEarning(data);
      expect(earningMock.create).toHaveBeenCalledWith({ data });
    });

    it('updateEarning', async () => {
      earningMock.updateMany.mockResolvedValue({ count: 1 });
      earningMock.findUnique.mockResolvedValue({ id: 'e-1', status: CommissionStatus.ACCRUED });
      const result = await CommissionsRepo.updateEarning('e-1', 'gc-1', { status: CommissionStatus.ACCRUED });
      expect(result.status).toBe(CommissionStatus.ACCRUED);
    });

    it('listEarnings', async () => {
      (prismaMock /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).$transaction.mockResolvedValue([[], 0]);
      await CommissionsRepo.listEarnings('gc-1', {}, 0, 10);
      expect((prismaMock /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).$transaction).toHaveBeenCalled();
    });

    it('listAllEarnings', async () => {
      (prismaMock /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).$transaction.mockResolvedValue([[], 0]);
      await CommissionsRepo.listAllEarnings({ gamingCenterId: 'gc-1' }, 0, 10);
      expect((prismaMock /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).$transaction).toHaveBeenCalled();
    });
  });

  describe('Payment operations', () => {
    it('createEarningPayment', async () => {
      const data = { earningId: 'e-1', amount: 25, currency: 'IRR' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
      paymentMock.create.mockResolvedValue({ id: 'ep-1' });
      await CommissionsRepo.createEarningPayment(data);
      expect(paymentMock.create).toHaveBeenCalled();
    });

    it('findEarningPayments', async () => {
      paymentMock.findMany.mockResolvedValue([]);
      await CommissionsRepo.findEarningPayments('e-1');
      expect(paymentMock.findMany).toHaveBeenCalled();
    });

    it('updateEarningPaymentsStatus', async () => {
      paymentMock.updateMany.mockResolvedValue({ count: 1 });
      await CommissionsRepo.updateEarningPaymentsStatus(
        'e-1',
        CommissionPaymentStatus.PAID,
        CommissionPaymentStatus.REFUNDED
      );
      expect(paymentMock.updateMany).toHaveBeenCalledWith({
        where: { earningId: 'e-1', status: CommissionPaymentStatus.PAID },
        data: { status: CommissionPaymentStatus.REFUNDED },
      });
    });
  });

  describe('Reservation operations', () => {
    it('findReservationForEarning includes direct payments and groupBooking.payments', async () => {
      resMock.findUnique.mockResolvedValue({ id: 'res-1' });
      await CommissionsRepo.findReservationForEarning('res-1');
      expect(resMock.findUnique).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        include: {
          earning: true,
          payments: {
            where: { status: 'PAID' },
            orderBy: { paidAt: 'desc' },
          },
          groupBooking: {
            include: {
              payments: {
                where: { status: 'PAID' },
                orderBy: { paidAt: 'desc' },
              },
            },
          },
        },
      });
    });
  });

  describe('Additional operations', () => {
    it('findEarningWithPayments', async () => {
      earningMock.findUnique.mockResolvedValue({ id: 'e-1' });
      await CommissionsRepo.findEarningWithPayments('e-1');
      expect(earningMock.findUnique).toHaveBeenCalled();
    });

    it('findCommissionById', async () => {
      earningMock.findFirst.mockResolvedValue({ id: 'e-1' });
      await CommissionsRepo.findCommissionById('e-1', 'gc-1');
      expect(earningMock.findFirst).toHaveBeenCalled();
    });

    it('transaction', async () => {
      (prismaMock /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).$transaction.mockResolvedValue('ok');
      await CommissionsRepo.transaction(async () => 'ok');
      expect((prismaMock /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).$transaction).toHaveBeenCalled();
    });
  });
});
