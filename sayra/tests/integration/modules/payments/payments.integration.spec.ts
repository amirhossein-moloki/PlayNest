import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PaymentsStation } from '../../../../src/modules/payments/payments.station';
import { PaymentsRepo } from '../../../../src/modules/payments/payments.repo';
import { ReservationPaymentState, PaymentStatus } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';
import httpStatus from 'http-status';

jest.mock('../../../../src/modules/payments/payments.repo');

// Mock fetch for ZarinPal API
const mockFetch = jest.fn() /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
global.fetch = mockFetch;

const MockedPaymentsRepo = PaymentsRepo as jest.Mocked<typeof PaymentsRepo>;

describe('Payment Flow Integration (Mocked Repo)', () => {
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
      stationSnapshot: { currency: 'IRR' },
    };

    const payment = {
      id: 'pay-1',
      status: PaymentStatus.INITIATED,
    };

    MockedPaymentsRepo.findReservationForUpdate.mockResolvedValue(reservation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
    MockedPaymentsRepo.createPaymentAndUpdateReservation.mockResolvedValue({ payment } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
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
    };

    MockedPaymentsRepo.findReservationForUpdate.mockResolvedValue(reservation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    await expect(PaymentsStation.initiatePayment({
      gamingCenterId,
      reservationId,
      idempotencyKey: 'key-2',
    })).rejects.toThrow(new AppError('Reservation is already paid.', httpStatus.CONFLICT));

    expect(MockedPaymentsRepo.createPaymentAndUpdateReservation).not.toHaveBeenCalled();
  });

  it('should handle payment provider failure', async () => {
    const reservation = {
      id: reservationId,
      totalPrice: 50000,
      paymentState: ReservationPaymentState.UNPAID,
      stationSnapshot: {},
    };

    const payment = { id: 'pay-2', status: PaymentStatus.INITIATED };

    MockedPaymentsRepo.findReservationForUpdate.mockResolvedValue(reservation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
    MockedPaymentsRepo.createPaymentAndUpdateReservation.mockResolvedValue({ payment } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
        data: null,
        errors: { code: -1, message: 'Invalid Merchant ID' },
      }),
    });

    await expect(PaymentsStation.initiatePayment({
      gamingCenterId,
      reservationId,
      idempotencyKey: 'key-3',
    })).rejects.toThrow('Payment initiation failed with provider.');
  });
});
