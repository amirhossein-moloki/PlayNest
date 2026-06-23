import { describe, it, expect, jest } from '@jest/globals';
import { env } from '../../../src/config/env';

import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';
import { SessionActorType, UserRole } from '@prisma/client';

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    session: { findUnique: jest.fn() },
  }
}));

describe('Users API', () => {
  it('GET /auth/me should return 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('x-api-key', env.STATIC_API_KEY);
    expect(res.status).toBe(401);
  });

  it('GET /auth/me should return 200 for valid user token', async () => {
    const userId = 'clp6u7o00000108msh9v8k7g5';
    const gamingCenterId = 'gc1';
    const token = generateAccessToken({ sessionId: 's1', actorId: userId, actorType: SessionActorType.USER });
    (prisma.user.findUnique /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue({
      id: userId,
      fullName: 'Staff User',
      role: UserRole.STAFF,
      gamingCenterId,
    });

    const res = await request(app).get('/api/v1/auth/me').set('x-api-key', env.STATIC_API_KEY).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(userId);
  });
});
