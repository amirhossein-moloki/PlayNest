import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';
import httpStatus from 'http-status';

jest.mock('../../../src/common/repositories/idempotency.repo');
jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    gamingCenter: { findUnique: jest.fn() },
    customerAccount: { findUnique: jest.fn() },
    session: { findUnique: jest.fn() },
    reservation: { findFirst: jest.fn() }
  }
}));

describe('Payment API', () => {
  const gamingCenterId = 'clp6u7o00000108msh9v8k7g5';
  const reservationId = 'clp6u7o00000108msh9v8k7g6';
  const userId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /payments/init', () => {
    it('should return 401 if token is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservations/${reservationId}/payments/init`)
        .send({});
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
    });

    it('should return 404 for wrong tenant', async () => {
      const token = generateAccessToken({ sessionId: 's1', actorId: userId, actorType: 'USER' });
      (prisma.user.findUnique /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue({ id: userId, gamingCenterId: 'other-gc', role: 'MANAGER' });

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservations/${reservationId}/payments/init`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(httpStatus.NOT_FOUND);
    });
  });

  describe('Webhooks', () => {
    it('should return 401 if webhook signature is missing', async () => {
      const res = await request(app).post('/api/v1/webhooks/payments/zarinpal').send({ authority: 'a' });
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
    });
  });
});
