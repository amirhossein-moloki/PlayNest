import { describe, it, expect, jest } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { PaymentsRepo } from '../../../../src/modules/payments/payments.repo';
import { walletService } from '../../../../src/modules/wallet/wallet.station';
import { PaymentStatus, ReservationPaymentState, ReservationStatus } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';
import httpStatus from 'http-status';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock dependencies of PaymentsRepo
jest.mock('../../../../src/modules/commissions/commissions.station', () => ({
  commissionsStation: {
    calculateCommission: jest.fn().mockImplementation(() => Promise.resolve()),
  },
}));

describe('PaymentsRepo', () => {
  const gamingCenterId = 'gc-1';
  const reservationId = 'res-1';
  const paymentId = 'pay-1';

  const reservationMock = prismaMock.reservation as any;
  const paymentMock = prismaMock.payment as any;

  describe('findReservationForUpdate', () => {
    it('should find a reservation', async () => {
      reservationMock.findFirst.mockResolvedValue({ id: reservationId });
      const result = await PaymentsRepo.findReservationForUpdate(reservationId, gamingCenterId);
      expect(result?.id).toBe(reservationId);
    });
  });

  describe('updatePayment', () => {
    it('should update a payment', async () => {
      const data = { status: PaymentStatus.PAID };
      paymentMock.update.mockResolvedValue({ id: paymentId, status: PaymentStatus.PAID });
      const result = await PaymentsRepo.updatePayment(paymentId, data);
      expect(result.status).toBe(PaymentStatus.PAID);
    });
  });

  describe('handleSuccessfulPayment', () => {
    it('should handle successful payment and update reservation', async () => {
      const mockPayment = {
        id: paymentId,
        reservationId,
        status: PaymentStatus.PENDING,
        reservation: { id: reservationId, paymentState: ReservationPaymentState.PENDING, status: ReservationStatus.CONFIRMED },
      };

      paymentMock.findUnique.mockResolvedValue(mockPayment);
      paymentMock.update.mockResolvedValue({ ...mockPayment, status: PaymentStatus.PAID });
      reservationMock.update.mockResolvedValue({ id: reservationId, paymentState: ReservationPaymentState.PAID });

      await PaymentsRepo.handleSuccessfulPayment(prismaMock as any, paymentId);

      expect(paymentMock.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: paymentId },
        data: expect.objectContaining({ status: PaymentStatus.PAID }),
      }));
      expect(reservationMock.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: reservationId },
        data: { paymentState: ReservationPaymentState.PAID },
      }));
    });

    it('should mark payment as PAID and trigger wallet refund without resurrecting CANCELED reservation', async () => {
      const refundSpy = jest.spyOn(walletService, 'refundReservationToWallet').mockResolvedValue(undefined);
      const mockPayment = {
        id: paymentId,
        reservationId,
        status: PaymentStatus.INITIATED,
        reservation: {
          id: reservationId,
          status: ReservationStatus.CANCELED,
          paymentState: ReservationPaymentState.UNPAID,
        },
      };

      paymentMock.findUnique.mockResolvedValue(mockPayment);
      paymentMock.update.mockResolvedValue({ ...mockPayment, status: PaymentStatus.PAID });

      await PaymentsRepo.handleSuccessfulPayment(prismaMock as any, paymentId, 'ref-123');

      expect(paymentMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
          data: expect.objectContaining({
            status: PaymentStatus.PAID,
            referenceCode: 'ref-123',
          }),
        })
      );
      expect(refundSpy).toHaveBeenCalledWith(reservationId, prismaMock as any);
      expect(reservationMock.update).not.toHaveBeenCalled();
      refundSpy.mockRestore();
    });

    it('should mark payment as PAID and trigger wallet refund for EXPIRED reservation', async () => {
      const refundSpy = jest.spyOn(walletService, 'refundReservationToWallet').mockResolvedValue(undefined);
      const mockPayment = {
        id: paymentId,
        reservationId,
        status: PaymentStatus.PENDING,
        reservation: {
          id: reservationId,
          status: ReservationStatus.EXPIRED,
          paymentState: ReservationPaymentState.PENDING,
        },
      };

      paymentMock.findUnique.mockResolvedValue(mockPayment);
      paymentMock.update.mockResolvedValue({ ...mockPayment, status: PaymentStatus.PAID });

      await PaymentsRepo.handleSuccessfulPayment(prismaMock as any, paymentId, 'ref-exp');

      expect(paymentMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
          data: expect.objectContaining({
            status: PaymentStatus.PAID,
            referenceCode: 'ref-exp',
          }),
        })
      );
      expect(refundSpy).toHaveBeenCalledWith(reservationId, prismaMock as any);
      expect(reservationMock.update).not.toHaveBeenCalled();
      refundSpy.mockRestore();
    });

    it('should return early idempotently if payment is already REFUNDED', async () => {
      const refundSpy = jest.spyOn(walletService, 'refundReservationToWallet').mockResolvedValue(undefined);
      const mockPayment = {
        id: paymentId,
        reservationId,
        status: PaymentStatus.REFUNDED,
        reservation: {
          id: reservationId,
          status: ReservationStatus.CANCELED,
          paymentState: ReservationPaymentState.REFUNDED,
        },
      };
      paymentMock.findUnique.mockResolvedValue(mockPayment);
      const res = await PaymentsRepo.handleSuccessfulPayment(prismaMock as any, paymentId);
      expect(res.status).toBe(PaymentStatus.REFUNDED);
      expect(paymentMock.update).not.toHaveBeenCalled();
      expect(refundSpy).not.toHaveBeenCalled();
      refundSpy.mockRestore();
    });

    it('should throw if payment not found', async () => {
      paymentMock.findUnique.mockResolvedValue(null);
      await expect(PaymentsRepo.handleSuccessfulPayment(prismaMock as any, 'invalid')).rejects.toThrow(
        new AppError('Payment not found.', httpStatus.NOT_FOUND)
      );
    });

    it('should return early if already paid', async () => {
      const mockPayment = {
        status: PaymentStatus.PAID,
        reservation: { paymentState: ReservationPaymentState.PAID }
      };
      paymentMock.findUnique.mockResolvedValue(mockPayment);
      await PaymentsRepo.handleSuccessfulPayment(prismaMock as any, paymentId);
      expect(paymentMock.update).not.toHaveBeenCalled();
    });
  });

  describe('handleFailedPayment', () => {
    it('should handle failed payment and update reservation', async () => {
      const mockPayment = {
        id: paymentId,
        reservationId,
        status: PaymentStatus.PENDING,
        reservation: { id: reservationId, paymentState: ReservationPaymentState.PENDING },
      };

      paymentMock.findUnique.mockResolvedValue(mockPayment);
      paymentMock.update.mockResolvedValue({ ...mockPayment, status: PaymentStatus.FAILED });
      reservationMock.update.mockResolvedValue({ id: reservationId, paymentState: ReservationPaymentState.FAILED });

      await PaymentsRepo.handleFailedPayment(prismaMock as any, paymentId);

      expect(paymentMock.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: paymentId },
        data: expect.objectContaining({ status: PaymentStatus.FAILED }),
      }));
    });

    it('should throw if payment not found', async () => {
      paymentMock.findUnique.mockResolvedValue(null);
      await expect(PaymentsRepo.handleFailedPayment(prismaMock as any, 'invalid')).rejects.toThrow(
        new AppError('Payment not found.', httpStatus.NOT_FOUND)
      );
    });

    it('should return early if already in target state', async () => {
      paymentMock.findUnique.mockResolvedValue({ status: PaymentStatus.FAILED });
      await PaymentsRepo.handleFailedPayment(prismaMock as any, paymentId, PaymentStatus.FAILED);
      expect(paymentMock.update).not.toHaveBeenCalled();
    });

    it('should restore wallet balance for bookingHold when payment fails', async () => {
      const mockPayment = {
        id: paymentId,
        bookingHoldId: 'hold-123',
        status: PaymentStatus.INITIATED,
        walletAmount: 35000,
        currency: 'IRR',
        bookingHold: {
          id: 'hold-123',
          customerAccountId: 'cust-account-1',
          status: 'ACTIVE',
        },
      };

      paymentMock.findUnique.mockResolvedValue(mockPayment);
      paymentMock.update.mockResolvedValue({ ...mockPayment, status: PaymentStatus.FAILED });
      (prismaMock.customerAccount as any).update = (jest.fn() as any).mockResolvedValue({ id: 'cust-account-1', walletBalance: 35000 });
      (prismaMock.walletTransaction as any).findFirst = (jest.fn() as any).mockResolvedValue(null);
      (prismaMock.walletTransaction as any).create = (jest.fn() as any).mockResolvedValue({ id: 'wtx-refund-1' });
      (prismaMock.bookingHold as any).updateMany = (jest.fn() as any).mockResolvedValue({ count: 1 });

      await PaymentsRepo.handleFailedPayment(prismaMock as any, paymentId, PaymentStatus.FAILED, 'Gateway error');

      expect((prismaMock.customerAccount as any).update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'cust-account-1' },
        data: { walletBalance: { increment: 35000 } },
      }));
      expect((prismaMock.walletTransaction as any).create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          customerAccountId: 'cust-account-1',
          amount: 35000,
          type: 'REFUND',
          paymentId,
        }),
      }));
      expect((prismaMock.bookingHold as any).updateMany).toHaveBeenCalledWith({
        where: { id: 'hold-123', status: 'ACTIVE' },
        data: { status: 'RELEASED' },
      });
    });

    it('should resolve customerAccountId from debit walletTransaction if missing from parent entity', async () => {
      const mockPayment = {
        id: paymentId,
        status: PaymentStatus.INITIATED,
        walletAmount: 20000,
        currency: 'IRR',
      };

      paymentMock.findUnique.mockResolvedValue(mockPayment);
      paymentMock.update.mockResolvedValue({ ...mockPayment, status: PaymentStatus.FAILED });
      (prismaMock.customerAccount as any).update = (jest.fn() as any).mockResolvedValue({ id: 'cust-account-fallback', walletBalance: 20000 });
      (prismaMock.walletTransaction as any).findFirst = (jest.fn() as any)
        .mockResolvedValueOnce({ customerAccountId: 'cust-account-fallback' }) // debitTx lookup
        .mockResolvedValueOnce(null); // existingFailureRefund lookup
      (prismaMock.walletTransaction as any).create = (jest.fn() as any).mockResolvedValue({ id: 'wtx-refund-2' });

      await PaymentsRepo.handleFailedPayment(prismaMock as any, paymentId, PaymentStatus.FAILED);

      expect((prismaMock.customerAccount as any).update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'cust-account-fallback' },
        data: { walletBalance: { increment: 20000 } },
      }));
    });

    it('should not duplicate refund if REFUND transaction already exists', async () => {
      const mockPayment = {
        id: paymentId,
        status: PaymentStatus.INITIATED,
        walletAmount: 20000,
        currency: 'IRR',
        reservation: { customerAccountId: 'cust-account-1' },
      };

      paymentMock.findUnique.mockResolvedValue(mockPayment);
      paymentMock.update.mockResolvedValue({ ...mockPayment, status: PaymentStatus.FAILED });
      (prismaMock.customerAccount as any).update = jest.fn();
      (prismaMock.walletTransaction as any).findFirst = (jest.fn() as any).mockResolvedValue({ id: 'already-refunded-wtx' });

      await PaymentsRepo.handleFailedPayment(prismaMock as any, paymentId, PaymentStatus.FAILED);

      expect((prismaMock.customerAccount as any).update).not.toHaveBeenCalled();
    });
  });

  describe('createPaymentAndUpdateReservation', () => {
    it('should create payment and update reservation in transaction', async () => {
      const paymentData = { amount: 1000 } as any;
      (prismaMock as any).$transaction.mockImplementation(async (cb: any) => cb(prismaMock));
      paymentMock.create.mockResolvedValue({ id: 'pay-1' });
      reservationMock.update.mockResolvedValue({ id: reservationId });

      await PaymentsRepo.createPaymentAndUpdateReservation({ reservationId, paymentData });
      expect(paymentMock.create).toHaveBeenCalled();
      expect(reservationMock.update).toHaveBeenCalled();
    });
  });
});
