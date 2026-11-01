/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import { env } from '../../../src/config/env';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

jest.mock('../../../src/config/redis', () => ({
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  del: jest.fn().mockImplementation(() => Promise.resolve(1)),
}));
jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    commissionPolicy: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    earning: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    earningPayment: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    settings: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    ['$extends']: jest.fn().mockReturnThis(),
    ['$transaction']: jest.fn().mockImplementation((arg: any) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      if (typeof arg === 'function') {
        return arg(prisma);
      }
      return Promise.resolve(arg);
    }),
    ['$executeRaw']: jest.fn().mockResolvedValue(1 as never),
  },
}));

describe('Commissions API', () => {
  const SECRET = env.JWT_ACCESS_SECRET;
  const MANAGER_TOKEN = jwt.sign({ sessionId: 's-1', actorId: 'mgr-1', actorType: 'USER' }, SECRET);
  const STAFF_TOKEN = jwt.sign({ sessionId: 's-2', actorId: 'stf-1', actorType: 'USER' }, SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as any).mockImplementation((arg: any) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      if (typeof arg === 'function') {
        return arg(prisma);
      }
      return Promise.resolve(arg);
    });

    (prisma.session.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === 's-1' || where.tokenHash) {
        return Promise.resolve({ id: 's-1', actorId: 'mgr-1', actorType: 'USER', expiresAt: new Date(Date.now() + 100000) });
      }
      return Promise.resolve({ id: 's-2', actorId: 'stf-1', actorType: 'USER', expiresAt: new Date(Date.now() + 100000) });
    });

    (prisma.user.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === 'mgr-1') {
        return Promise.resolve({ id: 'mgr-1', role: 'MANAGER', gamingCenterId: 'gc-1', isActive: true });
      }
      return Promise.resolve({ id: 'stf-1', role: 'STAFF', gamingCenterId: 'gc-1', isActive: true });
    });
  });

  describe('GET /policy', () => {
    it('should return policy for manager', async () => {
      (prisma.commissionPolicy.findUnique as any).mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: 'PERCENT',
        percentBps: 500,
        monthlyTarget: 20,
        maxPercentBps: 10000,
      });

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/commissions/policy')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.monthlyTarget).toBe(20);
    });

    it('should deny STAFF access to policy', async () => {
      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/commissions/policy')
        .set('Authorization', `Bearer ${STAFF_TOKEN}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST / PUT /policy', () => {
    it('should update commission policy with monthly target', async () => {
      (prisma.commissionPolicy.findUnique as any).mockResolvedValue(null);
      (prisma.commissionPolicy.upsert as any).mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: 'PERCENT',
        percentBps: 1000,
        monthlyTarget: 15,
        maxPercentBps: 10000,
      });

      const res = await request(app)
        .put('/api/v1/gamingCenters/gc-1/commissions/policy')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
        .send({
          type: 'PERCENT',
          percentBps: 1000,
          monthlyTarget: 15,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.monthlyTarget).toBe(15);
    });

    it('should reject invalid percentBps exceeding maxPercentBps', async () => {
      const res = await request(app)
        .post('/api/v1/gamingCenters/gc-1/commissions/policy')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
        .send({
          type: 'PERCENT',
          percentBps: 12000, // Invalid > 10000
          monthlyTarget: 10,
        });

      expect(res.status).toBe(400);
    });

    it('should reject negative monthlyTarget', async () => {
      const res = await request(app)
        .post('/api/v1/gamingCenters/gc-1/commissions/policy')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
        .send({
          type: 'PERCENT',
          percentBps: 500,
          monthlyTarget: -5,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /target-progress', () => {
    it('should return monthly target progress', async () => {
      (prisma.commissionPolicy.findUnique as any).mockResolvedValue({
        monthlyTarget: 10,
      });
      (prisma.settings.findUnique as any).mockResolvedValue({
        timeZone: 'UTC',
      });
      (prisma.earning.count as any).mockResolvedValue(4);

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/commissions/target-progress?targetPeriod=2026-10')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        gamingCenterId: 'gc-1',
        targetPeriod: '2026-10',
        monthlyTarget: 10,
        paidReservationCount: 4,
        remainingCount: 6,
        isTargetReached: false,
      });
    });
  });

  describe('GET / (list earnings)', () => {
    it('should return paginated list of earnings', async () => {
      (prisma.earning.findMany as any).mockResolvedValue([
        {
          id: 'e-1',
          reservationId: 'res-1',
          gamingCenterId: 'gc-1',
          baseAmount: 10000,
          commissionAmount: 1000,
          targetPeriod: '2026-10',
          targetReached: false,
          targetContribution: true,
        },
      ]);
      (prisma.earning.count as any).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/commissions?page=1&pageSize=10')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });
  });
});
