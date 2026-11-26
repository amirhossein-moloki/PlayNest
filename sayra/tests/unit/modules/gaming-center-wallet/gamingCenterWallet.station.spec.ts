import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  GamingCenterWalletTransactionType,
  SessionActorType,
  WithdrawalRequestStatus,
} from '@prisma/client';
import { prismaMock } from '../../../mocks/prisma';
import { gamingCenterWalletStation } from '../../../../src/modules/gaming-center-wallet/gamingCenterWallet.station';
import { auditService } from '../../../../src/modules/audit/audit.station';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../../src/modules/audit/audit.station', () => ({
  auditService: {
    log: jest.fn().mockResolvedValue(true as never),
  },
}));

describe('gamingCenterWalletStation Unit Tests', () => {
  const gcMock = prismaMock.gamingCenter as any;
  const txMock = prismaMock.gamingCenterWalletTransaction as any;
  const wrMock = prismaMock.gamingCenterWithdrawalRequest as any;

  beforeEach(() => {
    (prismaMock.$executeRaw as any) = jest.fn().mockResolvedValue(1 as never);
    (prismaMock.$transaction as any) = jest.fn().mockImplementation(async (cb: any) => cb(prismaMock));
  });

  describe('creditReservationSettlement', () => {
    it('should credit net payout once to GamingCenter wallet and be idempotent on repeat call', async () => {
      gcMock.findUnique.mockResolvedValue({ id: 'gc-1', walletBalance: 0, reservedBalance: 0 });
      gcMock.update.mockResolvedValue({ id: 'gc-1', walletBalance: 90000 });
      txMock.findUnique.mockResolvedValueOnce(null);
      txMock.create.mockImplementation(async ({ data }: any) => ({ id: 'gctx-1', ...data }));

      const first = await gamingCenterWalletStation.creditReservationSettlement(
        {
          gamingCenterId: 'gc-1',
          reservationId: 'res-100',
          earningId: 'earn-100',
          grossAmount: 100000,
          commissionAmount: 10000,
          netAmount: 90000,
          currency: 'IRR',
        },
        prismaMock as any
      );

      expect(first?.credited).toBe(true);
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: { walletBalance: { increment: 90000 } },
      });
      expect(txMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gamingCenterId: 'gc-1',
          type: GamingCenterWalletTransactionType.RESERVATION_SETTLEMENT,
          grossAmount: 100000,
          commissionAmount: 10000,
          amount: 90000,
          idempotencyKey: 'reservation_settlement:res-100',
        }),
      });

      // Repeat call hits idempotency key and must not increment balance a second time
      jest.clearAllMocks();
      (prismaMock.$executeRaw as any) = jest.fn().mockResolvedValue(1 as never);
      gcMock.findUnique.mockResolvedValue({ id: 'gc-1', walletBalance: 90000, reservedBalance: 0 });
      txMock.findUnique.mockResolvedValueOnce({
        id: 'gctx-1',
        idempotencyKey: 'reservation_settlement:res-100',
        amount: 90000,
      });

      const repeat = await gamingCenterWalletStation.creditReservationSettlement(
        {
          gamingCenterId: 'gc-1',
          reservationId: 'res-100',
          earningId: 'earn-100',
          grossAmount: 100000,
          commissionAmount: 10000,
          netAmount: 90000,
        },
        prismaMock as any
      );

      expect(repeat?.credited).toBe(false);
      expect(gcMock.update).not.toHaveBeenCalled();
      expect(txMock.create).not.toHaveBeenCalled();
    });
  });

  describe('getWalletOverview', () => {
    it('should return net availableBalance with withdrawalCommissionRate: 0 and cumulative summary', async () => {
      gcMock.findUnique.mockResolvedValue({
        id: 'gc-1',
        walletBalance: 90000,
        reservedBalance: 0,
        lastWithdrawalRequestAt: null,
      });
      txMock.aggregate
        .mockResolvedValueOnce({ _sum: { grossAmount: 100000, commissionAmount: 10000, amount: 90000 } })
        .mockResolvedValueOnce({ _sum: { grossAmount: 0, commissionAmount: 0, amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });
      wrMock.aggregate.mockResolvedValueOnce({ _sum: { amount: 0 } });

      const overview = await gamingCenterWalletStation.getWalletOverview('gc-1');

      expect(overview).toEqual({
        gamingCenterId: 'gc-1',
        walletBalance: 90000,
        reservedBalance: 0,
        availableBalance: 90000,
        currency: 'IRR',
        commissionDeductedAt: 'RESERVATION_COMPLETION',
        withdrawalCommissionRate: 0,
        canWithdraw: true,
        lastWithdrawalRequestAt: null,
        nextAllowedWithdrawalAt: null,
        summary: {
          totalGrossSettled: 100000,
          totalCommissionDeducted: 10000,
          totalNetCredited: 90000,
          totalWithdrawn: 0,
          pendingWithdrawalsAmount: 0,
        },
      });
    });
  });

  describe('requestWithdrawal', () => {
    it('should allow withdrawing 100% of availableBalance (90,000 out of 90,000) with 0% commission', async () => {
      gcMock.findUnique.mockResolvedValue({
        id: 'gc-1',
        walletBalance: 90000,
        reservedBalance: 0,
        lastWithdrawalRequestAt: null,
      });
      wrMock.findFirst.mockResolvedValue(null);
      wrMock.create.mockImplementation(async ({ data }: any) => ({ id: 'gcwr-1', ...data }));
      gcMock.update.mockResolvedValue({ id: 'gc-1', walletBalance: 90000, reservedBalance: 90000 });
      txMock.create.mockResolvedValue({ id: 'gctx-hold-1' });

      const withdrawal = await gamingCenterWalletStation.requestWithdrawal(
        {
          gamingCenterId: 'gc-1',
          amount: 90000,
          bankDetails: { sheba: 'IR123456789012345678901234' },
          note: 'Full net payout',
        },
        { id: 'mgr-1', actorType: SessionActorType.USER },
        { ip: '127.0.0.1' }
      );

      expect(withdrawal.amount).toBe(90000);
      expect(withdrawal.requestedByUserId).toBe('mgr-1');
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: {
          reservedBalance: { increment: 90000 },
          lastWithdrawalRequestAt: expect.any(Date),
        },
      });
      expect(txMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gamingCenterId: 'gc-1',
          grossAmount: 0,
          commissionAmount: 0,
          amount: -90000,
          type: GamingCenterWalletTransactionType.WITHDRAWAL_HOLD,
          idempotencyKey: 'withdrawal_hold:gcwr-1',
        }),
      });
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should set requestedByUserId to null when invoked by PLATFORM_ADMIN actor', async () => {
      gcMock.findUnique.mockResolvedValue({
        id: 'gc-1',
        walletBalance: 90000,
        reservedBalance: 0,
        lastWithdrawalRequestAt: null,
      });
      wrMock.findFirst.mockResolvedValue(null);
      wrMock.create.mockImplementation(async ({ data }: any) => ({ id: 'gcwr-adm', ...data }));
      gcMock.update.mockResolvedValue({ id: 'gc-1' });
      txMock.create.mockResolvedValue({ id: 'gctx-hold-adm' });

      const withdrawal = await gamingCenterWalletStation.requestWithdrawal(
        { gamingCenterId: 'gc-1', amount: 50000 },
        { id: 'pa-1', actorType: SessionActorType.PLATFORM_ADMIN }
      );

      expect(withdrawal.requestedByUserId).toBeNull();
    });

    it('should reject withdrawal exceeding availableBalance with 400 and reject within 24h cooldown with 429', async () => {
      gcMock.findUnique.mockResolvedValue({
        id: 'gc-1',
        walletBalance: 90000,
        reservedBalance: 0,
        lastWithdrawalRequestAt: null,
      });
      wrMock.findFirst.mockResolvedValue(null);

      await expect(
        gamingCenterWalletStation.requestWithdrawal(
          { gamingCenterId: 'gc-1', amount: 90001 },
          { id: 'mgr-1', actorType: SessionActorType.USER }
        )
      ).rejects.toMatchObject({ statusCode: 400 });

      await expect(
        gamingCenterWalletStation.requestWithdrawal(
          { gamingCenterId: 'gc-1', amount: 0 },
          { id: 'mgr-1', actorType: SessionActorType.USER }
        )
      ).rejects.toMatchObject({ statusCode: 400 });

      gcMock.findUnique.mockResolvedValue({
        id: 'gc-1',
        walletBalance: 90000,
        reservedBalance: 0,
        lastWithdrawalRequestAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      await expect(
        gamingCenterWalletStation.requestWithdrawal(
          { gamingCenterId: 'gc-1', amount: 10000 },
          { id: 'mgr-1', actorType: SessionActorType.USER }
        )
      ).rejects.toMatchObject({ statusCode: 429 });
    });
  });

  describe('Platform Admin lifecycle transitions', () => {
    it('should approve PENDING request, reject non-PENDING approval with 409, and reject -> refund reservedBalance + reset cooldown', async () => {
      wrMock.findUnique.mockResolvedValue({
        id: 'gcwr-1',
        gamingCenterId: 'gc-1',
        amount: 90000,
        currency: 'IRR',
        status: WithdrawalRequestStatus.PENDING,
        note: null,
      });
      wrMock.update.mockResolvedValue({
        id: 'gcwr-1',
        status: WithdrawalRequestStatus.APPROVED,
        reviewerAdminId: 'pa-1',
      });

      const approved = await gamingCenterWalletStation.approveWithdrawal('gcwr-1', 'pa-1', 'Verified');
      expect(approved.status).toBe(WithdrawalRequestStatus.APPROVED);

      wrMock.findUnique.mockResolvedValue({
        id: 'gcwr-1',
        gamingCenterId: 'gc-1',
        status: WithdrawalRequestStatus.PAID,
      });
      await expect(gamingCenterWalletStation.approveWithdrawal('gcwr-1', 'pa-1')).rejects.toMatchObject({
        statusCode: 409,
      });

      // Reject releases reserved balance and recomputes lastWithdrawalRequestAt from active requests
      wrMock.findUnique.mockResolvedValue({
        id: 'gcwr-1',
        gamingCenterId: 'gc-1',
        amount: 90000,
        currency: 'IRR',
        status: WithdrawalRequestStatus.PENDING,
        note: null,
      });
      gcMock.findUnique.mockResolvedValue({ id: 'gc-1', walletBalance: 90000, reservedBalance: 90000 });
      wrMock.update.mockResolvedValue({ id: 'gcwr-1', status: WithdrawalRequestStatus.REJECTED });
      wrMock.findFirst.mockResolvedValue(null);
      gcMock.update.mockResolvedValue({ id: 'gc-1', walletBalance: 90000, reservedBalance: 0 });
      txMock.create.mockResolvedValue({ id: 'gctx-ref-1' });

      const rejected = await gamingCenterWalletStation.rejectWithdrawal('gcwr-1', 'pa-1', 'Invalid IBAN');
      expect(rejected.status).toBe(WithdrawalRequestStatus.REJECTED);
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: {
          reservedBalance: { decrement: 90000 },
          lastWithdrawalRequestAt: null,
        },
      });
      expect(txMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 90000,
          type: GamingCenterWalletTransactionType.WITHDRAWAL_REFUND,
          idempotencyKey: 'withdrawal_refund:gcwr-1',
        }),
      });
    });

    it('should handle PROCESSING, PAID (0% fee exact deduction), and FAILED transitions', async () => {
      wrMock.findUnique.mockResolvedValue({
        id: 'gcwr-2',
        gamingCenterId: 'gc-1',
        amount: 90000,
        currency: 'IRR',
        status: WithdrawalRequestStatus.APPROVED,
        paymentReference: null,
        note: null,
      });
      wrMock.update.mockResolvedValue({ id: 'gcwr-2', status: WithdrawalRequestStatus.PROCESSING });

      const proc = await gamingCenterWalletStation.updateWithdrawalPayment('gcwr-2', 'pa-1', {
        status: 'PROCESSING',
        paymentReference: 'ACH-100',
      });
      expect(proc.status).toBe(WithdrawalRequestStatus.PROCESSING);

      // PAID deducts both reservedBalance and walletBalance by exact 90000
      wrMock.findUnique.mockResolvedValue({
        id: 'gcwr-2',
        gamingCenterId: 'gc-1',
        amount: 90000,
        currency: 'IRR',
        status: WithdrawalRequestStatus.PROCESSING,
        paymentReference: 'ACH-100',
        note: null,
      });
      gcMock.findUnique.mockResolvedValue({ id: 'gc-1', walletBalance: 90000, reservedBalance: 90000 });
      gcMock.update.mockResolvedValue({ id: 'gc-1', walletBalance: 0, reservedBalance: 0 });
      txMock.create.mockResolvedValue({ id: 'gctx-paid-2' });
      wrMock.update.mockResolvedValue({ id: 'gcwr-2', status: WithdrawalRequestStatus.PAID });

      const paid = await gamingCenterWalletStation.updateWithdrawalPayment('gcwr-2', 'pa-1', {
        status: 'PAID',
        paymentReference: 'ACH-100',
      });
      expect(paid.status).toBe(WithdrawalRequestStatus.PAID);
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: {
          reservedBalance: { decrement: 90000 },
          walletBalance: { decrement: 90000 },
        },
      });
      expect(txMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          commissionAmount: 0,
          amount: -90000,
          type: GamingCenterWalletTransactionType.WITHDRAWAL_PAID,
          idempotencyKey: 'withdrawal_paid:gcwr-2',
        }),
      });

      // FAILED releases reservedBalance and records WITHDRAWAL_REFUND
      jest.clearAllMocks();
      (prismaMock.$executeRaw as any) = jest.fn().mockResolvedValue(1 as never);
      (prismaMock.$transaction as any) = jest.fn().mockImplementation(async (cb: any) => cb(prismaMock));
      wrMock.findUnique.mockResolvedValue({
        id: 'gcwr-3',
        gamingCenterId: 'gc-1',
        amount: 45000,
        currency: 'IRR',
        status: WithdrawalRequestStatus.PROCESSING,
        paymentReference: null,
        note: null,
      });
      gcMock.findUnique.mockResolvedValue({ id: 'gc-1', walletBalance: 45000, reservedBalance: 45000 });
      gcMock.update.mockResolvedValue({ id: 'gc-1', walletBalance: 45000, reservedBalance: 0 });
      txMock.create.mockResolvedValue({ id: 'gctx-fail-3' });
      wrMock.update.mockResolvedValue({ id: 'gcwr-3', status: WithdrawalRequestStatus.FAILED });

      const failed = await gamingCenterWalletStation.updateWithdrawalPayment('gcwr-3', 'pa-1', {
        status: 'FAILED',
        paymentReference: 'BANK-ERR',
      });
      expect(failed.status).toBe(WithdrawalRequestStatus.FAILED);
      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: { reservedBalance: { decrement: 45000 } },
      });
      expect(txMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 45000,
          type: GamingCenterWalletTransactionType.WITHDRAWAL_REFUND,
          idempotencyKey: 'withdrawal_failed_refund:gcwr-3',
        }),
      });
    });
  });

  describe('reverseReservationSettlement', () => {
    it('should cap reversal deduction to available balance and record shortfall metadata when center already withdrew funds', async () => {
      txMock.findUnique
        .mockResolvedValueOnce({
          id: 'gctx-orig',
          gamingCenterId: 'gc-1',
          grossAmount: 100000,
          commissionAmount: 10000,
          amount: 90000,
          currency: 'IRR',
          earningId: 'earn-1',
        })
        .mockResolvedValueOnce(null);
      gcMock.findUnique.mockResolvedValue({ id: 'gc-1', walletBalance: 30000, reservedBalance: 10000 });
      gcMock.update.mockResolvedValue({ id: 'gc-1', walletBalance: 10000, reservedBalance: 10000 });
      txMock.create.mockImplementation(async ({ data }: any) => ({ id: 'gctx-rev', ...data }));

      const rev = await gamingCenterWalletStation.reverseReservationSettlement(
        'res-shortfall',
        'Post-completion refund',
        prismaMock as any
      );

      expect(gcMock.update).toHaveBeenCalledWith({
        where: { id: 'gc-1' },
        data: { walletBalance: { decrement: 20000 } },
      });
      expect(rev?.metadata).toEqual({
        requestedReversal: 90000,
        deductedAmount: 20000,
        shortfallAmount: 70000,
        requiresManualRecovery: true,
      });
    });
  });
});
