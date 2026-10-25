import { prismaMock } from '../../../mocks/prisma';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PaymentStatus, RefundStatus, ReservationPaymentState, ReconciliationStatus, LedgerEntryType } from '@prisma/client';
import { RefundsStation } from '../../../../src/modules/payments/payments.refund.station';
import { RefundsRepo } from '../../../../src/modules/payments/payments.refund.repo';
import { LedgerRepo } from '../../../../src/modules/payments/ledger.repo';
import { ReconciliationStation } from '../../../../src/modules/payments/reconciliation.station';
import { PaymentsRepo } from '../../../../src/modules/payments/payments.repo';
import AppError from '../../../../src/common/errors/AppError';
import httpStatus from 'http-status';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Phase 6 — Refunds, Ledger & Reconciliation Unit Tests', () => {
  const gamingCenterId = 'gc-100';
  const paymentId = 'pay-100';

  const reservationMock = prismaMock.reservation as any;
  const paymentMock = prismaMock.payment as any;
  const reconciliationMock = prismaMock.reconciliationRecord as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('RefundsStation - Request Refund', () => {
    it('should throw error if refund amount is not a positive integer', async () => {
      await expect(
        RefundsStation.requestRefund({
          gamingCenterId,
          paymentId,
          amount: -500,
          currency: 'IRR',
        })
      ).rejects.toThrow(new AppError('Refund amount must be a positive integer.', httpStatus.BAD_REQUEST));

      await expect(
        RefundsStation.requestRefund({
          gamingCenterId,
          paymentId,
          amount: 0,
          currency: 'IRR',
        })
      ).rejects.toThrow(new AppError('Refund amount must be a positive integer.', httpStatus.BAD_REQUEST));
    });

    it('should return existing refund if idempotencyKey matches', async () => {
      const existingRefund = {
        id: 'ref-existing',
        paymentId,
        gamingCenterId,
        amount: 50000,
        currency: 'IRR',
        status: RefundStatus.SUCCESSFUL,
        providerRefundId: 'FAKE_REFUND_123',
        failureReason: null,
        processedAt: new Date(),
        createdAt: new Date(),
      };

      jest.spyOn(RefundsRepo, 'findRefundByIdempotencyKey').mockResolvedValue(existingRefund as any);

      const result = await RefundsStation.requestRefund({
        gamingCenterId,
        paymentId,
        amount: 50000,
        currency: 'IRR',
        idempotencyKey: 'idem-key-1',
      });

      expect(result.refundId).toBe('ref-existing');
      expect(result.status).toBe(RefundStatus.SUCCESSFUL);
    });

    it('should reject refund request if payment is not in PAID status', async () => {
      jest.spyOn(RefundsRepo, 'findRefundByIdempotencyKey').mockResolvedValue(null);
      jest.spyOn(PaymentsRepo, 'transaction').mockImplementation(async (cb: any) => cb(prismaMock));
      jest.spyOn(RefundsRepo, 'findPaymentForRefundLock').mockResolvedValue({
        id: paymentId,
        gamingCenterId,
        amount: 100000,
        currency: 'IRR',
        status: PaymentStatus.PENDING,
        provider: 'FAKE',
        providerPaymentId: 'auth-1',
        reservationId: 'res-1',
      } as any);

      await expect(
        RefundsStation.requestRefund({
          gamingCenterId,
          paymentId,
          amount: 50000,
          currency: 'IRR',
        })
      ).rejects.toThrow(
        new AppError('Only successful (PAID) payments can be refunded. Current payment status is PENDING.', httpStatus.BAD_REQUEST)
      );
    });

    it('should reject refund request if currency does not match payment currency', async () => {
      jest.spyOn(RefundsRepo, 'findRefundByIdempotencyKey').mockResolvedValue(null);
      jest.spyOn(PaymentsRepo, 'transaction').mockImplementation(async (cb: any) => cb(prismaMock));
      jest.spyOn(RefundsRepo, 'findPaymentForRefundLock').mockResolvedValue({
        id: paymentId,
        gamingCenterId,
        amount: 100000,
        currency: 'IRR',
        status: PaymentStatus.PAID,
        provider: 'FAKE',
        providerPaymentId: 'auth-1',
        reservationId: 'res-1',
      } as any);

      await expect(
        RefundsStation.requestRefund({
          gamingCenterId,
          paymentId,
          amount: 50000,
          currency: 'USD',
        })
      ).rejects.toThrow(
        new AppError('Refund currency (USD) does not match payment currency (IRR).', httpStatus.BAD_REQUEST)
      );
    });

    it('should reject refund request if amount exceeds remaining refundable balance', async () => {
      jest.spyOn(RefundsRepo, 'findRefundByIdempotencyKey').mockResolvedValue(null);
      jest.spyOn(PaymentsRepo, 'transaction').mockImplementation(async (cb: any) => cb(prismaMock));
      jest.spyOn(RefundsRepo, 'findPaymentForRefundLock').mockResolvedValue({
        id: paymentId,
        gamingCenterId,
        amount: 100000,
        currency: 'IRR',
        status: PaymentStatus.PAID,
        provider: 'FAKE',
        providerPaymentId: 'auth-1',
        reservationId: 'res-1',
      } as any);

      jest.spyOn(RefundsRepo, 'calculateRefundableBalance').mockResolvedValue({
        totalRefundedOrPending: 70000,
        remainingBalance: 30000,
      });

      await expect(
        RefundsStation.requestRefund({
          gamingCenterId,
          paymentId,
          amount: 50000,
          currency: 'IRR',
        })
      ).rejects.toThrow(
        new AppError('Requested refund amount (50000) exceeds remaining refundable balance (30000).', httpStatus.CONFLICT)
      );
    });

    it('should process full refund successfully and update reservation paymentState to REFUNDED', async () => {
      jest.spyOn(RefundsRepo, 'findRefundByIdempotencyKey').mockResolvedValue(null);
      jest.spyOn(PaymentsRepo, 'transaction').mockImplementation(async (cb: any) => cb(prismaMock));

      const mockPayment = {
        id: paymentId,
        gamingCenterId,
        amount: 100000,
        currency: 'IRR',
        status: PaymentStatus.PAID,
        provider: 'FAKE',
        providerPaymentId: 'auth-1',
        reservationId: 'res-1',
      };

      const mockRefund = {
        id: 'ref-1',
        paymentId,
        amount: 100000,
        currency: 'IRR',
        status: RefundStatus.PENDING,
      };

      const mockUpdatedRefund = {
        ...mockRefund,
        status: RefundStatus.SUCCESSFUL,
        providerRefundId: 'FAKE_REFUND_100',
        processedAt: new Date(),
        createdAt: new Date(),
      };

      jest.spyOn(RefundsRepo, 'findPaymentForRefundLock').mockResolvedValue(mockPayment as any);
      jest.spyOn(RefundsRepo, 'calculateRefundableBalance')
        .mockResolvedValueOnce({ totalRefundedOrPending: 0, remainingBalance: 100000 })
        .mockResolvedValueOnce({ totalRefundedOrPending: 100000, remainingBalance: 0 });

      jest.spyOn(RefundsRepo, 'createRefundRecord').mockResolvedValue(mockRefund as any);
      jest.spyOn(RefundsRepo, 'updateRefundStatus').mockResolvedValue(mockUpdatedRefund as any);
      jest.spyOn(LedgerRepo, 'createRefundEntry').mockResolvedValue({ id: 'led-1' } as any);
      reservationMock.update.mockResolvedValue({ id: 'res-1', paymentState: ReservationPaymentState.REFUNDED });

      const result = await RefundsStation.requestRefund({
        gamingCenterId,
        paymentId,
        amount: 100000,
        currency: 'IRR',
      });

      expect(result.status).toBe(RefundStatus.SUCCESSFUL);
      expect(LedgerRepo.createRefundEntry).toHaveBeenCalled();
      const callData = (LedgerRepo.createRefundEntry as any).mock.calls[0][1];
      expect(callData).toEqual(
        expect.objectContaining({
          refundId: 'ref-1',
          amount: 100000,
        })
      );
      expect(reservationMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: { paymentState: ReservationPaymentState.REFUNDED },
        })
      );
    });
  });

  describe('LedgerRepo - Append-Only Financial Ledger', () => {
    it('should create PAYMENT_COLLECTION ledger entry idempotently', async () => {
      const txMock = prismaMock as any;
      txMock.ledgerEntry.findUnique.mockResolvedValue(null);
      txMock.ledgerEntry.create.mockResolvedValue({
        id: 'led-coll-1',
        idempotencyKey: 'payment-ledger-pay-1',
        entryType: LedgerEntryType.PAYMENT_COLLECTION,
        amount: 100000,
      });

      const entry = await LedgerRepo.createCollectionEntry(txMock, {
        gamingCenterId,
        paymentId: 'pay-1',
        amount: 100000,
        currency: 'IRR',
      });

      expect(entry.id).toBe('led-coll-1');
      expect(txMock.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            idempotencyKey: 'payment-ledger-pay-1',
            entryType: LedgerEntryType.PAYMENT_COLLECTION,
          }),
        })
      );
    });

    it('should not recreate ledger entry if idempotencyKey already exists', async () => {
      const txMock = prismaMock as any;
      const existingEntry = {
        id: 'led-coll-1',
        idempotencyKey: 'payment-ledger-pay-1',
      };
      txMock.ledgerEntry.findUnique.mockResolvedValue(existingEntry);

      const entry = await LedgerRepo.createCollectionEntry(txMock, {
        gamingCenterId,
        paymentId: 'pay-1',
        amount: 100000,
        currency: 'IRR',
      });

      expect(entry.id).toBe('led-coll-1');
      expect(txMock.ledgerEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('ReconciliationStation - Automated Auditing', () => {
    it('should identify MATCHED payment and refunds without discrepancies', async () => {
      const mockPayment = {
        id: paymentId,
        gamingCenterId,
        amount: 100000,
        currency: 'IRR',
        provider: 'FAKE',
        providerPaymentId: 'FAKE_AUTH_1',
        status: PaymentStatus.PAID,
        refunds: [
          { id: 'ref-1', amount: 50000, status: RefundStatus.SUCCESSFUL },
        ],
        ledgerEntries: [
          { entryType: LedgerEntryType.PAYMENT_COLLECTION, amount: 100000 },
          { refundId: 'ref-1', entryType: LedgerEntryType.REFUND_DISBURSEMENT, amount: 50000 },
        ],
      };

      paymentMock.findFirst.mockResolvedValue(mockPayment);
      reconciliationMock.create.mockImplementation((args: any) => Promise.resolve({
        id: 'rec-1',
        paymentId,
        status: args.data.status,
        reconciledAt: new Date(),
      }));

      const report = await ReconciliationStation.reconcilePayment({
        gamingCenterId,
        paymentId,
      });

      expect(report.status).toBe(ReconciliationStatus.MATCHED);
      expect(report.discrepancies).toHaveLength(0);
    });

    it('should flag MISSING_PROVIDER_REF if PAID payment lacks providerPaymentId', async () => {
      const mockPayment = {
        id: paymentId,
        gamingCenterId,
        amount: 100000,
        currency: 'IRR',
        provider: 'MANUAL',
        providerPaymentId: null,
        referenceCode: null,
        status: PaymentStatus.PAID,
        refunds: [],
        ledgerEntries: [
          { entryType: LedgerEntryType.PAYMENT_COLLECTION, amount: 100000 },
        ],
      };

      paymentMock.findFirst.mockResolvedValue(mockPayment);
      reconciliationMock.create.mockImplementation((args: any) => Promise.resolve({
        id: 'rec-2',
        paymentId,
        status: args.data.status,
        reconciledAt: new Date(),
      }));

      const report = await ReconciliationStation.reconcilePayment({
        gamingCenterId,
        paymentId,
      });

      expect(report.status).toBe(ReconciliationStatus.MISSING_PROVIDER_REF);
      expect(report.discrepancies.length).toBeGreaterThan(0);
    });
  });
});
