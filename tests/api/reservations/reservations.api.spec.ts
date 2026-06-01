import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';

jest.mock('../../../src/modules/reservations/reservations.repo');
jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    gamingCenter: { findUnique: jest.fn() },
    customerAccount: { findUnique: jest.fn() },
    session: { findUnique: jest.fn() }
  }
}));

describe('Reservation API', () => {
  const gamingCenterId = 'clp6u7o00000108msh9v8k7g5';
  const userId = 'u1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 for unauthorized reservations list', async () => {
    const res = await request(app).get(`/api/v1/gamingCenters/${gamingCenterId}/reservations`);
    expect(res.status).toBe(401);
  });

  it('should return 403 for STAFF attempting to confirm a booking', async () => {
    const token = generateAccessToken({ sessionId: 's1', actorId: userId, actorType: 'USER' });
    (prisma.user.findUnique /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue({ id: userId, gamingCenterId, role: 'STAFF' });

    const res = await request(app)
      .post(`/api/v1/gamingCenters/${gamingCenterId}/reservations/res-1/confirm`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
