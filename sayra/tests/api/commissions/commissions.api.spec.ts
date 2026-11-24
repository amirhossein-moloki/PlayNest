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
    platformSetting: {
      findUnique: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn(),
    },
    earning: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    earningPayment: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    settings: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    platformAdmin: {
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
  const PLATFORM_ADMIN_TOKEN = jwt.sign(
    { sessionId: 's-admin', actorId: 'pa-1', actorType: 'PLATFORM_ADMIN', mfaVerified: true },
    SECRET
  );

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
      if (where.id === 's-admin') {
        return Promise.resolve({ id: 's-admin', actorId: 'pa-1', actorType: 'PLATFORM_ADMIN', mfaVerifiedAt: new Date(), revokedAt: null, expiresAt: new Date(Date.now() + 100000) });
      }
      return Promise.resolve({ id: 's-2', actorId: 'stf-1', actorType: 'USER', expiresAt: new Date(Date.now() + 100000) });
    });

    (prisma.user.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === 'mgr-1') {
        return Promise.resolve({ id: 'mgr-1', role: 'MANAGER', gamingCenterId: 'gc-1', isActive: true });
      }
      return Promise.resolve({ id: 'stf-1', role: 'STAFF', gamingCenterId: 'gc-1', isActive: true });
    });

    (prisma.platformAdmin.findUnique as any).mockResolvedValue({
      id: 'pa-1',
      isActive: true,
      isSuperuser: true,
      totpEnabled: true,
      totpSetupCompleted: true,
    });

    (prisma.gamingCenter.findUnique as any).mockResolvedValue({
      id: 'gc-1',
      slug: 'gc-1',
    });

    (prisma.platformSetting.findUnique as any).mockResolvedValue({
      id: 'default',
      platformCommissionPercent: 5,
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
        isActive: true,
      });

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/commissions/policy')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.monthlyTarget).toBe(20);
    });

    it('should return platform default policy fallback for manager when center policy is missing', async () => {
      (prisma.commissionPolicy.findUnique as any).mockResolvedValue(null);
      (prisma.platformSetting.findUnique as any).mockResolvedValue({
        platformCommissionPercent: 7.5,
      });

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/commissions/policy')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.percentBps).toBe(750);
      expect(res.body.data.isPlatformDefault).toBe(true);
    });

    it('should deny STAFF access to policy', async () => {
      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/commissions/policy')
        .set('Authorization', `Bearer ${STAFF_TOKEN}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST / PUT /policy & /pay & /waive authorization', () => {
    it('should deny MANAGER from mutating commission policy via PUT or POST', async () => {
      const putRes = await request(app)
        .put('/api/v1/gamingCenters/gc-1/commissions/policy')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
        .send({
          type: 'PERCENT',
          percentBps: 1000,
          monthlyTarget: 15,
        });
      expect(putRes.status).toBe(403);

      const postRes = await request(app)
        .post('/api/v1/gamingCenters/gc-1/commissions/policy')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
        .send({
          type: 'PERCENT',
          percentBps: 1000,
          monthlyTarget: 15,
        });
      expect(postRes.status).toBe(403);
    });

    it('should deny MANAGER from recording commission payments or waiving commissions', async () => {
      const payRes = await request(app)
        .post('/api/v1/gamingCenters/gc-1/commissions/earn-1/pay')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
        .send({
          amount: 1000,
          currency: 'IRR',
        });
      expect(payRes.status).toBe(403);

      const waiveRes = await request(app)
        .post('/api/v1/gamingCenters/gc-1/commissions/earn-1/waive')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
        .send({ reason: 'Should be forbidden' });
      expect(waiveRes.status).toBe(403);
    });

    it('should allow PLATFORM_ADMIN to update commission policy with monthly target', async () => {
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
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`)
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
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`)
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
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`)
        .send({
          type: 'PERCENT',
          percentBps: 500,
          monthlyTarget: -5,
        });

      expect(res.status).toBe(400);
    });

    it('should allow PLATFORM_ADMIN to record commission payment and waive pending commission', async () => {
      (prisma.earning.findFirst as any).mockResolvedValue({
        id: 'earn-1',
        gamingCenterId: 'gc-1',
        status: 'PENDING',
        commissionAmount: 5000,
        currency: 'IRR',
      });
      (prisma.earningPayment.create as any).mockResolvedValue({
        id: 'ep-1',
        earningId: 'earn-1',
        amount: 5000,
        currency: 'IRR',
        status: 'PAID',
      });
      (prisma.earningPayment.findMany as any).mockResolvedValue([
        { id: 'ep-1', amount: 5000, status: 'PAID' },
      ]);
      (prisma.earning.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.earning.findUnique as any).mockResolvedValue({
        id: 'earn-1',
        gamingCenterId: 'gc-1',
        status: 'CHARGED',
      });

      const payRes = await request(app)
        .post('/api/v1/gamingCenters/gc-1/commissions/earn-1/pay')
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`)
        .send({
          amount: 5000,
          currency: 'IRR',
          method: 'TRANSFER',
          referenceCode: 'TX-123',
        });

      expect(payRes.status).toBe(201);
      expect(payRes.body.data.id).toBe('ep-1');

      (prisma.earning.findFirst as any).mockResolvedValue({
        id: 'earn-2',
        gamingCenterId: 'gc-1',
        status: 'PENDING',
        commissionAmount: 5000,
        currency: 'IRR',
      });
      (prisma.earning.findUnique as any).mockResolvedValue({
        id: 'earn-2',
        gamingCenterId: 'gc-1',
        status: 'WAIVED',
        targetContribution: false,
      });

      const waiveRes = await request(app)
        .post('/api/v1/gamingCenters/gc-1/commissions/earn-2/waive')
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`)
        .send({ reason: 'Goodwill waiver' });

      expect(waiveRes.status).toBe(200);
      expect(waiveRes.body.data.status).toBe('WAIVED');
    });
  });

  describe('Platform Admin Commission Routes', () => {
    it('should allow PLATFORM_ADMIN to get & upsert center commission policy and list/pay/waive commissions', async () => {
      (prisma.commissionPolicy.findUnique as any).mockResolvedValue(null);
      (prisma.commissionPolicy.upsert as any).mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: 'PERCENT',
        percentBps: 800,
        isActive: true,
      });

      const upsertRes = await request(app)
        .put('/api/v1/platform-admin/gaming-centers/gc-1/commission-policy')
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`)
        .send({
          type: 'PERCENT',
          percentBps: 800,
        });

      expect(upsertRes.status).toBe(200);
      expect(upsertRes.body.data.percentBps).toBe(800);

      (prisma.commissionPolicy.findUnique as any).mockResolvedValue({
        id: 'pol-1',
        gamingCenterId: 'gc-1',
        type: 'PERCENT',
        percentBps: 800,
        isActive: true,
      });
      const getPolicyRes = await request(app)
        .get('/api/v1/platform-admin/gaming-centers/gc-1/commission-policy')
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`);
      expect(getPolicyRes.status).toBe(200);
      expect(getPolicyRes.body.data.percentBps).toBe(800);

      (prisma.earning.findMany as any).mockResolvedValue([
        { id: 'earn-1', gamingCenterId: 'gc-1', status: 'PENDING', commissionAmount: 2500 },
      ]);
      (prisma.earning.count as any).mockResolvedValue(1);
      const listRes = await request(app)
        .get('/api/v1/platform-admin/commissions?gamingCenterId=gc-1')
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);

      (prisma.earning.findUnique as any)
        .mockResolvedValueOnce({
          id: 'earn-1',
          gamingCenterId: 'gc-1',
          status: 'PENDING',
          commissionAmount: 2500,
          currency: 'IRR',
          payments: [],
        })
        .mockResolvedValueOnce({
          id: 'earn-1',
          gamingCenterId: 'gc-1',
          status: 'CHARGED',
        });
      (prisma.earningPayment.create as any).mockResolvedValue({
        id: 'ep-2',
        earningId: 'earn-1',
        amount: 2500,
        currency: 'IRR',
        status: 'PAID',
      });
      (prisma.earningPayment.findMany as any).mockResolvedValue([
        { id: 'ep-2', amount: 2500, status: 'PAID' },
      ]);
      (prisma.earning.updateMany as any).mockResolvedValue({ count: 1 });

      const payRes = await request(app)
        .post('/api/v1/platform-admin/commissions/earn-1/pay')
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`)
        .send({ amount: 2500, currency: 'IRR', method: 'TRANSFER' });
      expect(payRes.status).toBe(201);
      expect(payRes.body.data.id).toBe('ep-2');

      (prisma.earning.findUnique as any)
        .mockResolvedValueOnce({
          id: 'earn-2',
          gamingCenterId: 'gc-1',
          status: 'PENDING',
          commissionAmount: 2500,
          currency: 'IRR',
          payments: [],
        })
        .mockResolvedValueOnce({
          id: 'earn-2',
          gamingCenterId: 'gc-1',
          status: 'WAIVED',
          targetContribution: false,
        });

      const waiveRes = await request(app)
        .post('/api/v1/platform-admin/commissions/earn-2/waive')
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`)
        .send({ reason: 'Admin waived' });
      expect(waiveRes.status).toBe(200);
      expect(waiveRes.body.data.status).toBe('WAIVED');
    });

    it('should deny MANAGER access to /platform-admin commission routes', async () => {
      const res = await request(app)
        .get('/api/v1/platform-admin/commissions')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);
      expect(res.status).toBe(403);
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
