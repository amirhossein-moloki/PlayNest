import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';
import { SessionActorType } from '@prisma/client';

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    session: { findUnique: jest.fn() },
    customerAccount: { findUnique: jest.fn() }
  }
}));

describe('Users & Customer API', () => {
  it('GET /customer/me should return 401 without token', async () => {
    const res = await request(app).get('/api/v1/customer/me');
    expect(res.status).toBe(401);
  });

  it('GET /customer/me should return 200 for valid customer token', async () => {
      const customerId = 'clp6u7o00000108msh9v8k7g5';
      const token = generateAccessToken({ sessionId: 's1', actorId: customerId, actorType: SessionActorType.CUSTOMER });
      (prisma.customerAccount.findUnique as any).mockResolvedValue({ id: customerId, fullName: 'John Doe' });

      const res = await request(app).get('/api/v1/customer/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(customerId);
  });
});
