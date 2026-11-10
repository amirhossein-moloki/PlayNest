/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';
import { zibalClient } from '../../../src/modules/payments/providers/zibal.client';
import httpStatus from 'http-status';

jest.mock('../../../src/modules/payments/providers/zibal.client', () => ({
  zibalClient: {
    request: jest.fn(),
    verify: jest.fn(),
  },
}));

jest.mock('../../../src/config/redis', () => ({
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  del: jest.fn().mockImplementation(() => Promise.resolve(1)),
}));
jest.mock('../../../src/common/repositories/idempotency.repo');
jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    gamingCenter: { findUnique: jest.fn() },
    customerAccount: { findUnique: jest.fn() },
    session: { findUnique: jest.fn() },
    reservation: { findFirst: jest.fn() },
    payment: { findFirst: jest.fn(), findUnique: jest.fn() },
  },
}));

describe('Payment API', () => {
  const gamingCenterId = 'clp6u7o00000108msh9v8k7g5';
  const reservationId = 'clp6u7o00000108msh9v8k7g6';
  const otherReservationId = 'clp6u7o00000108msh9v8k7g7';
  const userId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /payments/init', () => {
    it('should return 401 if token is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservation/${reservationId}/payments/init`)
        .send({});
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
    });

    it('should return 404 for wrong tenant (tenant mismatch or nonexistent center)', async () => {
      const token = generateAccessToken({ sessionId: 's1', actorId: userId, actorType: 'USER' });
      (prisma.user.findUnique as any).mockResolvedValue({ id: userId, gamingCenterId: 'other-gc', role: 'MANAGER' });

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservation/${reservationId}/payments/init`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(httpStatus.NOT_FOUND);
      expect(res.body.error?.message).toBe('GamingCenter not found.');
    });

    it('should forward gamingCenterId and return 404 if reservation does not exist, without creating payment', async () => {
      const token = generateAccessToken({ sessionId: 's1', actorId: userId, actorType: 'USER' });
      (prisma.user.findUnique as any).mockResolvedValue({ id: userId, gamingCenterId, role: 'MANAGER' });
      (prisma.reservation.findFirst as any).mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservation/${reservationId}/payments/init`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'idempotency-key-16-chars-1')
        .send({});

      expect(res.status).toBe(httpStatus.NOT_FOUND);
      expect(res.body.error?.message).toBe('Reservation not found.');
      expect(prisma.reservation.findFirst).toHaveBeenCalledWith({
        where: { id: reservationId, gamingCenterId },
      });
      expect(prisma.payment.findFirst).not.toHaveBeenCalled();
    });

    it('should return 404 if reservation belongs to a different gaming center, without creating payment', async () => {
      const token = generateAccessToken({ sessionId: 's1', actorId: userId, actorType: 'USER' });
      (prisma.user.findUnique as any).mockResolvedValue({ id: userId, gamingCenterId, role: 'MANAGER' });
      // Reservation belongs to otherGamingCenterId, so query scoped to gamingCenterId returns null
      (prisma.reservation.findFirst as any).mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservation/${otherReservationId}/payments/init`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'idempotency-key-16-chars-2')
        .send({});

      expect(res.status).toBe(httpStatus.NOT_FOUND);
      expect(res.body.error?.message).toBe('Reservation not found.');
      expect(prisma.reservation.findFirst).toHaveBeenCalledWith({
        where: { id: otherReservationId, gamingCenterId },
      });
    });

    it('should successfully forward gamingCenterId through router to handler when valid', async () => {
      const token = generateAccessToken({ sessionId: 's1', actorId: userId, actorType: 'USER' });
      (prisma.user.findUnique as any).mockResolvedValue({ id: userId, gamingCenterId, role: 'MANAGER' });
      (prisma.reservation.findFirst as any).mockResolvedValue({
        id: reservationId,
        gamingCenterId,
        totalPrice: 100000,
        customerPayableAmount: 100000,
        paymentState: 'UNPAID',
        status: 'CONFIRMED',
        stationSnapshot: { currency: 'IRR' },
      });

      (zibalClient.request as any).mockResolvedValue({
        trackId: '12345678',
        result: 100,
        message: 'success',
        paymentUrl: 'https://gateway.zibal.ir/start/12345678',
      });

      const mockTx = {
        payment: {
          create: jest.fn().mockImplementation(() =>
            Promise.resolve({
              id: 'clp6u7o00000108msh9v8k7g8',
              status: 'INITIATED',
              gamingCenterId,
              reservationId,
            })
          ),
        },
        reservation: {
          update: jest.fn().mockImplementation(() => Promise.resolve({})),
        },
      };
      (prisma as any).$transaction = jest.fn().mockImplementation(async (cb: any) => cb(mockTx));
      (prisma.payment.update as any) = jest.fn().mockImplementation(() => Promise.resolve({}));

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservation/${reservationId}/payments/init`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'idempotency-key-16-chars-3')
        .send({});

      expect(res.status).toBe(httpStatus.CREATED);
      expect(res.body.data.paymentId).toBe('clp6u7o00000108msh9v8k7g8');
      expect(res.body.data.checkoutUrl).toContain('12345678');
      expect(mockTx.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gamingCenter: { connect: { id: gamingCenterId } },
            reservation: { connect: { id: reservationId } },
          }),
        })
      );
    });
  });

  describe('GET /payments/verify', () => {
    it('should return 401 if token is missing', async () => {
      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/reservation/${reservationId}/payments/verify?Authority=A0001&Status=OK`);
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
    });

    it('should correctly access gamingCenterId and proceed past tenantGuard when authorized', async () => {
      const token = generateAccessToken({ sessionId: 's1', actorId: userId, actorType: 'USER' });
      (prisma.user.findUnique as any).mockResolvedValue({ id: userId, gamingCenterId, role: 'MANAGER' });
      (prisma.payment.findFirst as any).mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/reservation/${reservationId}/payments/verify?Authority=A0001&Status=OK`)
        .set('Authorization', `Bearer ${token}`);

      // Reaches payments.station verifyPayment -> payment not found
      expect(res.status).toBe(httpStatus.NOT_FOUND);
      expect(res.body.error?.message).toBe('Payment record not found.');
    });
  });

  describe('GET /payments/status', () => {
    it('should return 401 if token is missing', async () => {
      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/reservation/${reservationId}/payments/status`);
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
    });

    it('should correctly access gamingCenterId and proceed past tenantGuard when authorized', async () => {
      const token = generateAccessToken({ sessionId: 's1', actorId: userId, actorType: 'USER' });
      (prisma.user.findUnique as any).mockResolvedValue({ id: userId, gamingCenterId, role: 'MANAGER' });
      (prisma.payment.findFirst as any).mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/reservation/${reservationId}/payments/status`)
        .set('Authorization', `Bearer ${token}`);

      // Reaches payments.station getPaymentStatus -> payment not found
      expect(res.status).toBe(httpStatus.NOT_FOUND);
      expect(res.body.error?.message).toBe('No payment record found for this reservation.');
      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { reservationId, gamingCenterId },
        orderBy: { createdAt: 'desc' },
        include: { reservation: true },
      });
    });
  });

  describe('Webhooks', () => {
    it('should return 401 if webhook signature is missing', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/payments/zarinpal')
        .send({ authority: 'a' });
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
    });
  });
});
