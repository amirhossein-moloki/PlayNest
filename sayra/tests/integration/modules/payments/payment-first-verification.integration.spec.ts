/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app';
import { PaymentsRepo } from '../../../../src/modules/payments/payments.repo';
import { BookingHoldStation } from '../../../../src/modules/booking-hold/booking-hold.station';
import { IdempotencyRepo } from '../../../../src/common/repositories/idempotency.repo';
import { PaymentStatus, ReservationStatus, ReservationPaymentState } from '@prisma/client';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    payment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    bookingHold: {
      findUnique: jest.fn(),
    },
    reservation: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../../src/modules/payments/payments.repo');
jest.mock('../../../../src/modules/booking-hold/booking-hold.station');
jest.mock('../../../../src/modules/booking-hold/booking-hold.repo');
jest.mock('../../../../src/common/repositories/idempotency.repo');

const MockedPaymentsRepo = PaymentsRepo as jest.Mocked<typeof PaymentsRepo>;
const MockedBookingHoldStation = BookingHoldStation as jest.Mocked<typeof BookingHoldStation>;
const MockedIdempotencyRepo = IdempotencyRepo as jest.Mocked<typeof IdempotencyRepo>;

describe('Payment Verification and Webhook Conversion Integration', () => {
  const paymentId = 'pay-hold-001';
  const holdId = 'hold-001';

  beforeEach(() => {
    jest.clearAllMocks();
    MockedPaymentsRepo.transaction.mockImplementation(async (fn: any) => fn({
      payment: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      bookingHold: {
        updateMany: jest.fn(),
      },
    } as any));
  });

  describe('POST /api/v1/payments/:paymentId/verify', () => {
    it('should return already verified result idempotently if payment is already PAID', async () => {
      const mockPaidPayment = {
        id: paymentId,
        status: PaymentStatus.PAID,
        bookingHoldId: holdId,
        gamingCenterId: 'gc-1',
        referenceCode: 'REF-ALREADY-PAID',
      };

      MockedPaymentsRepo.transaction.mockImplementation(async (fn: any) => {
        return fn({
          payment: {
            findUnique: (jest.fn() as any).mockResolvedValue(mockPaidPayment),
          },
        });
      });

      const mockGroupBooking = {
        id: 'gb-1',
        status: ReservationStatus.CONFIRMED,
        paymentState: ReservationPaymentState.PAID,
      };

      MockedBookingHoldStation.convertHoldToReservations.mockResolvedValue(mockGroupBooking as any);

      const res = await request(app)
        .post(`/api/v1/payments/${paymentId}/verify`)
        .send({ authority: 'AUTH-123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe(PaymentStatus.PAID);
      expect(res.body.data.message).toBe('Payment already verified.');
      expect(MockedBookingHoldStation.convertHoldToReservations).toHaveBeenCalledWith(holdId, paymentId);
    });

    it('should return 404 if payment does not exist', async () => {
      MockedPaymentsRepo.transaction.mockImplementation(async (fn: any) => {
        return fn({
          payment: {
            findUnique: (jest.fn() as any).mockResolvedValue(null),
          },
        });
      });

      const res = await request(app)
        .post('/api/v1/payments/non-existent/verify')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/payments/webhook', () => {
    it('should safely process payment webhook and convert active hold to reservations', async () => {
      MockedIdempotencyRepo.findKey.mockResolvedValue(null);
      MockedIdempotencyRepo.createKey.mockResolvedValue({} as any);
      MockedIdempotencyRepo.updateKey.mockResolvedValue({} as any);

      const mockPayment = {
        id: paymentId,
        bookingHoldId: holdId,
        status: PaymentStatus.INITIATED,
        gamingCenterId: 'gc-1',
      };

      MockedPaymentsRepo.transaction.mockImplementation(async (fn: any) => {
        return fn({
          payment: {
            findUnique: (jest.fn() as any).mockResolvedValue(mockPayment),
            update: jest.fn(),
          },
        });
      });

      MockedPaymentsRepo.handleSuccessfulPayment.mockResolvedValue({
        id: paymentId,
        status: PaymentStatus.PAID,
      } as any);

      MockedBookingHoldStation.convertHoldToReservations.mockResolvedValue({
        id: 'gb-converted',
        status: ReservationStatus.CONFIRMED,
        paymentState: ReservationPaymentState.PAID,
      } as any);

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .send({
          paymentId,
          eventId: 'evt-webhook-1',
          status: 'SUCCEEDED',
          refId: 'REF-WEBHOOK-123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Webhook processed successfully.');
      expect(MockedBookingHoldStation.convertHoldToReservations).toHaveBeenCalledWith(holdId, paymentId, expect.anything());
    });

    it('should deduplicate multiple deliveries of same webhook event idempotently', async () => {
      MockedIdempotencyRepo.findKey.mockResolvedValue({
        key: 'evt-duplicate-1',
        status: 'COMPLETED' as any,
      } as any);

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .send({
          paymentId,
          eventId: 'evt-duplicate-1',
          status: 'SUCCEEDED',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Webhook already processed.');
      expect(MockedBookingHoldStation.convertHoldToReservations).not.toHaveBeenCalled();
    });
  });
});
