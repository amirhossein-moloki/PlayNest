import request from 'supertest';
import app from '../../../src/app';
import { BookingHoldStation } from '../../../src/modules/booking-hold/booking-hold.station';
import { prisma } from '../../../src/config/prisma';
import AppError from '../../../src/common/errors/AppError';
import { PaymentStatus } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../src/modules/booking-hold/booking-hold.station');

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('Payment-First Group Reservation Checkout & Verification API', () => {
  const mockCenter = {
    id: 'center_15',
    name: 'GameNet Arena',
    slug: 'gamenet-arena',
    isActive: true,
  };

  const validCheckoutPayload = {
    startTime: '2026-11-10T14:00:00.000Z',
    durationMinutes: 120,
    items: [
      { stationId: 'clh1111111111111111111111' },
      { stationId: 'clh2222222222222222222222' },
    ],
    customer: {
      fullName: 'Amir Hossein',
      phone: '09121234567',
    },
    note: 'Group reservation checkout test',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue(mockCenter);
    (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue(mockCenter);
  });

  describe('POST /api/v1/public/gamingCenters/:slug/group-reservations/checkout', () => {
    it('should return 201 with holdId, paymentId, and paymentUrl on successful checkout', async () => {
      const mockCheckoutResult = {
        holdId: 'hold_001',
        paymentId: 'pay_001',
        paymentStatus: PaymentStatus.INITIATED,
        holdExpiresAt: new Date('2026-11-10T13:10:00.000Z'),
        paymentUrl: 'https://payment.example/gateway/pay_001',
        totalAmount: 500000,
        currency: 'IRR',
      };

      (BookingHoldStation.checkoutGroupReservation as jest.Mock).mockResolvedValue(mockCheckoutResult);

      const res = await request(app)
        .post('/api/v1/public/gamingCenters/gamenet-arena/group-reservations/checkout')
        .set('idempotency-key', 'idemp_key_checkout_123456')
        .send(validCheckoutPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.holdId).toBe('hold_001');
      expect(res.body.data.paymentUrl).toBe('https://payment.example/gateway/pay_001');
      expect(BookingHoldStation.checkoutGroupReservation).toHaveBeenCalledWith(
        'gamenet-arena',
        expect.objectContaining({
          durationMinutes: 120,
          customer: { fullName: 'Amir Hossein', phone: '09121234567' },
        })
      );
    });

    it('should return 409 Conflict if stations are unavailable during hold creation', async () => {
      (BookingHoldStation.checkoutGroupReservation as jest.Mock).mockRejectedValue(
        new AppError('One or more selected stations are not available for the requested time.', 409, {
          code: 'SLOT_NOT_AVAILABLE',
        })
      );

      const res = await request(app)
        .post('/api/v1/public/gamingCenters/gamenet-arena/group-reservations/checkout')
        .set('idempotency-key', 'idemp_key_conflict_123456')
        .send(validCheckoutPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SLOT_NOT_AVAILABLE');
    });

    it('should return 400 Bad Request on invalid payload', async () => {
      const invalidPayload = {
        startTime: 'invalid-time',
        items: [],
        customer: { fullName: 'A', phone: '123' },
      };

      const res = await request(app)
        .post('/api/v1/public/gamingCenters/gamenet-arena/group-reservations/checkout')
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 502 Bad Gateway when payment gateway fails during initiation', async () => {
      (BookingHoldStation.checkoutGroupReservation as jest.Mock).mockRejectedValue(
        new AppError('Payment initiation rejected by provider.', 502, {
          code: 'GATEWAY_ERROR',
        })
      );

      const res = await request(app)
        .post('/api/v1/public/gamingCenters/gamenet-arena/group-reservations/checkout')
        .set('idempotency-key', 'idemp_key_gateway_err_123456')
        .send(validCheckoutPayload);

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Payment initiation rejected by provider.');
    });
  });
});
