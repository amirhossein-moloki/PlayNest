import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { env } from '../../../src/config/env';
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';

jest.mock('../../../src/modules/reservation/reservation.repo');
jest.mock('../../../src/modules/customer-panel/customer-panel.repo');
jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    customerAccount: { findUnique: jest.fn() },
    session: { findUnique: jest.fn() },
  },
}));

describe('Reservation Proposals API Integration', () => {
  const gamingCenterId = 'clp6u7o00000108msh9v8k7g5';
  const userId = 'u1';
  const customerId = 'cust1';
  const reservationId = 'clp6u7o00000108msh9v8k7g9';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if request is not authenticated', async () => {
    const res = await request(app)
      .post(`/api/v1/gamingCenters/${gamingCenterId}/reservation/${reservationId}/propose-time`)
      .set('x-api-key', env.STATIC_API_KEY)
      .send({
        startTime: '2026-11-01T10:00:00.000Z',
        endTime: '2026-11-01T12:00:00.000Z',
      });

    expect(res.status).toBe(401);
  });

  it('should prevent Customer from accessing staff propose-time route', async () => {
    const token = generateAccessToken({ sessionId: 's1', actorId: customerId, actorType: 'CUSTOMER' });
    (prisma.customerAccount.findUnique /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue({ id: customerId });

    const res = await request(app)
      .post(`/api/v1/gamingCenters/${gamingCenterId}/reservation/${reservationId}/propose-time`)
      .set('x-api-key', env.STATIC_API_KEY)
      .set('Authorization', `Bearer ${token}`)
      .send({
        startTime: '2026-11-01T10:00:00.000Z',
        endTime: '2026-11-01T12:00:00.000Z',
      });

    expect([403, 404]).toContain(res.status);
  });

  it('should validate request body on propose-time endpoint', async () => {
    const token = generateAccessToken({ sessionId: 's1', actorId: userId, actorType: 'USER' });
    (prisma.user.findUnique /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue({ id: userId, gamingCenterId, role: 'MANAGER' });

    const res = await request(app)
      .post(`/api/v1/gamingCenters/${gamingCenterId}/reservation/${reservationId}/propose-time`)
      .set('x-api-key', env.STATIC_API_KEY)
      .set('Authorization', `Bearer ${token}`)
      .send({
        startTime: 'invalid-date',
        endTime: 'invalid-date',
      });

    expect(res.status).toBe(400);
  });
});
