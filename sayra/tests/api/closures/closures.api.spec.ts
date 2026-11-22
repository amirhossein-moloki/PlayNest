/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { env } from '../../../src/config/env';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';

jest.mock('../../../src/config/redis', () => ({
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  del: jest.fn().mockImplementation(() => Promise.resolve(1)),
}));

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    gamingCenterClosure: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    reservation: {
      count: jest.fn(),
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
    ['$transaction']: jest.fn().mockImplementation((arg: any) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      if (typeof arg === 'function') return arg(prisma);
      return Promise.resolve(arg);
    }),
  },
}));

describe('Closures API Endpoints', () => {
  const SECRET = env.JWT_ACCESS_SECRET;
  const MANAGER_TOKEN = jwt.sign({ sessionId: 's-mgr-1', actorId: 'mgr-1', actorType: 'USER' }, SECRET);
  const STAFF_TOKEN = jwt.sign({ sessionId: 's-staff-1', actorId: 'staff-1', actorType: 'USER' }, SECRET);
  const OTHER_MANAGER_TOKEN = jwt.sign({ sessionId: 's-mgr-2', actorId: 'mgr-2', actorType: 'USER' }, SECRET);

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.session.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === 's-mgr-1') {
        return Promise.resolve({ id: 's-mgr-1', actorId: 'mgr-1', actorType: 'USER', expiresAt: new Date(Date.now() + 100000) });
      }
      if (where.id === 's-staff-1') {
        return Promise.resolve({ id: 's-staff-1', actorId: 'staff-1', actorType: 'USER', expiresAt: new Date(Date.now() + 100000) });
      }
      return Promise.resolve({ id: 's-mgr-2', actorId: 'mgr-2', actorType: 'USER', expiresAt: new Date(Date.now() + 100000) });
    });

    (prisma.user.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === 'mgr-1') {
        return Promise.resolve({ id: 'mgr-1', role: 'MANAGER', gamingCenterId: 'gc-1', isActive: true });
      }
      if (where.id === 'staff-1') {
        return Promise.resolve({ id: 'staff-1', role: 'STAFF', gamingCenterId: 'gc-1', isActive: true });
      }
      return Promise.resolve({ id: 'mgr-2', role: 'MANAGER', gamingCenterId: 'gc-2', isActive: true });
    });

    (prisma.gamingCenter.findUnique as any).mockResolvedValue({
      id: 'gc-1',
      slug: 'arena-1',
      isActive: true,
      verificationStatus: 'APPROVED',
    });
    (prisma.gamingCenter.findFirst as any).mockResolvedValue({
      id: 'gc-1',
      slug: 'arena-1',
    });
    (prisma.auditLog.create as any).mockResolvedValue({ id: 'audit-1' });
    (prisma.reservation.count as any).mockResolvedValue(0);
  });

  describe('POST /api/v1/gamingCenters/:gamingCenterId/closures/temporary', () => {
    it('closes bookings for the next N hours and returns 201', async () => {
      const created = {
        id: 'closure-temp-1',
        gamingCenterId: 'gc-1',
        title: 'Temporary booking closure',
        reason: 'Private tournament',
        startDate: new Date('2026-11-14T06:30:00.000Z'),
        endDate: new Date('2026-11-14T15:30:00.000Z'),
      };
      (prisma.gamingCenterClosure.create as any).mockResolvedValue(created);
      (prisma.reservation.count as any).mockResolvedValue(3);

      const res = await request(app)
        .post('/api/v1/gamingCenters/gc-1/closures/temporary')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
        .send({ hours: 9, reason: 'Private tournament' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('closure-temp-1');
      expect(res.body.data.durationHours).toBe(9);
      expect(res.body.data.durationMinutes).toBe(540);
      expect(res.body.data.affectedReservationsCount).toBe(3);
    });

    it('returns 400 on invalid duration', async () => {
      const res = await request(app)
        .post('/api/v1/gamingCenters/gc-1/closures/temporary')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
        .send({ hours: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 when unauthenticated and 403 for STAFF role', async () => {
      const unauth = await request(app)
        .post('/api/v1/gamingCenters/gc-1/closures/temporary')
        .send({ hours: 2 });
      expect(unauth.status).toBe(401);

      const forbidden = await request(app)
        .post('/api/v1/gamingCenters/gc-1/closures/temporary')
        .set('Authorization', `Bearer ${STAFF_TOKEN}`)
        .send({ hours: 2 });
      expect(forbidden.status).toBe(403);
    });

    it('enforces tenant isolation for another gaming center manager', async () => {
      const res = await request(app)
        .post('/api/v1/gamingCenters/gc-1/closures/temporary')
        .set('Authorization', `Bearer ${OTHER_MANAGER_TOKEN}`)
        .send({ hours: 2 });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/gamingCenters/:gamingCenterId/closures (with hours)', () => {
    it('accepts duration hours on existing closures endpoint', async () => {
      const created = {
        id: 'closure-dur-1',
        gamingCenterId: 'gc-1',
        title: 'Temporary booking closure',
        reason: null,
        startDate: new Date('2026-11-14T06:30:00.000Z'),
        endDate: new Date('2026-11-14T10:30:00.000Z'),
      };
      (prisma.gamingCenterClosure.create as any).mockResolvedValue(created);

      const res = await request(app)
        .post('/api/v1/gamingCenters/gc-1/closures')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
        .send({ hours: 4 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.durationHours).toBe(4);
      expect(res.body.data.durationMinutes).toBe(240);
    });
  });

  describe('GET /closures/active & POST /closures/reopen', () => {
    it('returns active closure status for manager', async () => {
      const futureEnd = new Date(Date.now() + 2 * 60 * 60 * 1000);
      (prisma.gamingCenterClosure.findMany as any).mockResolvedValue([
        {
          id: 'c-active',
          gamingCenterId: 'gc-1',
          title: 'Temp closure',
          reason: 'Maintenance',
          startDate: new Date(Date.now() - 60000),
          endDate: futureEnd,
        },
      ]);

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/closures/active')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isClosed).toBe(true);
      expect(res.body.data.closedUntil).toBe(futureEnd.toISOString());
      expect(res.body.data.remainingMinutes).toBeGreaterThan(0);
    });

    it('reopens active closures early on POST /reopen', async () => {
      (prisma.gamingCenterClosure.findMany as any).mockResolvedValue([
        { id: 'c-active-1', gamingCenterId: 'gc-1' },
      ]);
      (prisma.gamingCenterClosure.updateMany as any).mockResolvedValue({ count: 1 });

      const res = await request(app)
        .post('/api/v1/gamingCenters/gc-1/closures/reopen')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reopened).toBe(true);
      expect(res.body.data.reopenedCount).toBe(1);
      expect(res.body.data.endedClosureIds).toEqual(['c-active-1']);
    });
  });

  describe('Public closures routes', () => {
    it('returns active closure status on GET /public/gamingCenters/:slug/closures/active', async () => {
      const futureEnd = new Date(Date.now() + 60 * 60 * 1000);
      (prisma.gamingCenterClosure.findMany as any).mockResolvedValue([
        {
          id: 'c-pub-1',
          gamingCenterId: 'gc-1',
          title: 'Private event',
          reason: 'Tournament',
          startDate: new Date(Date.now() - 60000),
          endDate: futureEnd,
        },
      ]);

      const res = await request(app)
        .get('/api/v1/public/gamingCenters/arena-1/closures/active');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isClosed).toBe(true);
      expect(res.body.data.primaryClosure.id).toBe('c-pub-1');
    });

    it('filters active closures on GET /public/gamingCenters/:slug/closures?activeOnly=true', async () => {
      (prisma.gamingCenterClosure.findMany as any).mockResolvedValue([
        { id: 'c-pub-active', gamingCenterId: 'gc-1' },
      ]);

      const res = await request(app)
        .get('/api/v1/public/gamingCenters/arena-1/closures?activeOnly=true');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(prisma.gamingCenterClosure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gamingCenterId: 'gc-1',
            AND: expect.any(Array),
          }),
        })
      );
    });
  });
});
