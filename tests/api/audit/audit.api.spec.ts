/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import { env } from '../../../src/config/env';

import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
    ['$extends']: jest.fn().mockReturnThis(),
    ['$transaction']: jest.fn(),
  },
}));

describe('Audit API', () => {
  const SECRET = 't';
  const MOCK_TOKEN = jwt.sign({ sessionId: 's-1', actorId: 'u-1', actorType: 'USER' }, SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/v1/gamingCenters/:gamingCenterId/audit-logs should return audit logs', async () => {
    (prisma.session.findUnique as any).mockResolvedValue({ id: 's-1', actorId: 'u-1', actorType: 'USER', isActive: true });
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u-1', role: 'MANAGER', gamingCenterId: 'gc-1' });

    (prisma as any).$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        auditLog: {
          findMany: (jest.fn() as any).mockResolvedValue([
            { id: '1', action: 'CREATE', entity: 'Reservation', entityId: 'res-1', userId: 'u-1', createdAt: new Date() }
          ]),
          count: (jest.fn() as any).mockResolvedValue(1),
        }
      };
      return cb(tx);
    });

    const res = await request(app).get('/api/v1/gamingCenters/gc-1/audit-logs?page=1&pageSize=10').set('x-api-key', env.STATIC_API_KEY)
      .set('Authorization', `Bearer ${MOCK_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
