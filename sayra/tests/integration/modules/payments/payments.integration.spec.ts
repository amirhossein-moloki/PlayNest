/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PaymentsStation } from '../../../../src/modules/payments/payments.station';
import { PaymentsRepo } from '../../../../src/modules/payments/payments.repo';
import { ReservationPaymentState, PaymentStatus, ReservationStatus } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';
import httpStatus from 'http-status';

jest.mock('../../../../src/modules/payments/payments.repo');

const mockFetch = jest.fn() as any;
global.fetch = mockFetch;

const MockedPaymentsRepo = PaymentsRepo as jest.Mocked<typeof PaymentsRepo>;

describe('Payment Flow Integration', () => {
  const gamingCenterId = 'gc-1';
  const reservationId = 'res-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully initiate a payment', async () => {
    const reservation = {
      id: reservationId,
      totalPrice: 50000,
      paymentState: ReservationPaymentState.UNPAID,
      status: ReservationStatus.CONFIRMED,
      stationSnapshot: { currency: 'IRR' },
    };

    const payment = {
      id: 'pay-1',
      status: PaymentStatus.INITIATED,
    };

    MockedPaymentsRepo.findReservationForUpdate.mockResolvedValue(reservation as any);
    MockedPaymentsRepo.createPaymentAndUpdateReservation.mockResolvedValue({ payment } as any);

    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          data: { authority: 'A00000000000000000000000000000000001', code: 100 },
          errors: [],
        }),
    });

    const result = await PaymentsStation.initiatePayment({
      gamingCenterId,
      reservationId,
      idempotencyKey: 'key-1',
    });

    expect(result.paymentId).toBe(payment.id);
    expect(result.checkoutUrl).toContain('A00000000000000000000000000000000001');
    expect(MockedPaymentsRepo.updatePayment).toHaveBeenCalledWith(payment.id, {
      providerPaymentId: 'A00000000000000000000000000000000001',
    });
  });

  it('should fail if reservation is already paid', async () => {
    const reservation = {
      id: reservationId,
      paymentState: ReservationPaymentState.PAID,
      status: ReservationStatus.CONFIRMED,
    };

    MockedPaymentsRepo.findReservationForUpdate.mockResolvedValue(reservation as any);

    await expect(
      PaymentsStation.initiatePayment({
        gamingCenterId,
        reservationId,
        idempotencyKey: 'key-2',
      })
    ).rejects.toThrow(new AppError('Reservation is already paid.', httpStatus.CONFLICT));

    expect(MockedPaymentsRepo.createPaymentAndUpdateReservation).not.toHaveBeenCalled();
  });

  it('should fail if reservation is CANCELED', async () => {
    const reservation = {
      id: reservationId,
      paymentState: ReservationPaymentState.UNPAID,
      status: ReservationStatus.CANCELED,
    };

    MockedPaymentsRepo.findReservationForUpdate.mockResolvedValue(reservation as any);

    await expect(
      PaymentsStation.initiatePayment({
        gamingCenterId,
        reservationId,
        idempotencyKey: 'key-cancel',
      })
    ).rejects.toThrow(new AppError('Reservation is canceled or expired and cannot be paid.', httpStatus.BAD_REQUEST));
  });

  it('should handle payment provider failure during initiation', async () => {
    const reservation = {
      id: reservationId,
      totalPrice: 50000,
      paymentState: ReservationPaymentState.UNPAID,
      status: ReservationStatus.CONFIRMED,
      stationSnapshot: {},
    };

    const payment = { id: 'pay-2', status: PaymentStatus.INITIATED };

    MockedPaymentsRepo.findReservationForUpdate.mockResolvedValue(reservation as any);
    MockedPaymentsRepo.createPaymentAndUpdateReservation.mockResolvedValue({ payment } as any);
    MockedPaymentsRepo.transaction.mockImplementation(async (cb: any) => cb({}));

    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          data: null,
          errors: { code: -1, message: 'Invalid Merchant ID' },
        }),
    });

    await expect(
      PaymentsStation.initiatePayment({
        gamingCenterId,
        reservationId,
        idempotencyKey: 'key-3',
      })
    ).rejects.toThrow('Payment initiation failed with provider.');
  });

  it('should verify payment using server-to-server provider check', async () => {
    const payment = {
      id: 'pay-10',
      gamingCenterId,
      reservationId,
      amount: 50000,
      provider: 'ZARINPAL',
      providerPaymentId: 'AUTH_10',
      status: PaymentStatus.INITIATED,
    };

    MockedPaymentsRepo.findPaymentByProviderPaymentId.mockResolvedValue(payment as any);
    MockedPaymentsRepo.transaction.mockImplementation(async (cb: any) =>
      cb({})
    );
    MockedPaymentsRepo.handleSuccessfulPayment.mockResolvedValue({
      id: payment.id,
      status: PaymentStatus.PAID,
      referenceCode: 'REF_999',
    } as any);

    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          data: { code: 100, ref_id: 'REF_999' },
          errors: [],
        }),
    });

    const result = await PaymentsStation.verifyPayment({
      gamingCenterId,
      reservationId,
      authority: 'AUTH_10',
    });

    expect(result.success).toBe(true);
    expect(result.paymentStatus).toBe(PaymentStatus.PAID);
    expect(result.referenceCode).toBe('REF_999');
  });

  it('should return idempotent success if payment is already PAID', async () => {
    const payment = {
      id: 'pay-11',
      gamingCenterId,
      reservationId,
      amount: 50000,
      provider: 'ZARINPAL',
      providerPaymentId: 'AUTH_11',
      status: PaymentStatus.PAID,
      referenceCode: 'REF_ALREADY',
    };

    MockedPaymentsRepo.findPaymentByProviderPaymentId.mockResolvedValue(payment as any);

    const result = await PaymentsStation.verifyPayment({
      gamingCenterId,
      reservationId,
      authority: 'AUTH_11',
    });

    expect(result.success).toBe(true);
    expect(result.paymentStatus).toBe(PaymentStatus.PAID);
    expect(result.message).toBe('Payment already verified.');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
