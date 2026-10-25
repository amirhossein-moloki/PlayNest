import { describe, it, expect, jest } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { PaymentsRepo } from '../../../../src/modules/payments/payments.repo';
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

    it('should mark payment as PAID for reconciliation without resurrecting CANCELED reservation', async () => {
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
      expect(reservationMock.update).not.toHaveBeenCalled();
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
