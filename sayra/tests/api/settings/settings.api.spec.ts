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
    settings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
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

describe('Settings API', () => {
  const SECRET = env.JWT_ACCESS_SECRET;
  const MANAGER_TOKEN = jwt.sign({ sessionId: 's-1', actorId: 'mgr-1', actorType: 'USER' }, SECRET);
  const OTHER_MANAGER_TOKEN = jwt.sign({ sessionId: 's-2', actorId: 'mgr-2', actorType: 'USER' }, SECRET);

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.session.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === 's-1' || where.tokenHash) {
        return Promise.resolve({ id: 's-1', actorId: 'mgr-1', actorType: 'USER', expiresAt: new Date(Date.now() + 100000) });
      }
      return Promise.resolve({ id: 's-2', actorId: 'mgr-2', actorType: 'USER', expiresAt: new Date(Date.now() + 100000) });
    });

    (prisma.user.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === 'mgr-1') {
        return Promise.resolve({ id: 'mgr-1', role: 'MANAGER', gamingCenterId: 'gc-1', isActive: true });
      }
      return Promise.resolve({ id: 'mgr-2', role: 'MANAGER', gamingCenterId: 'gc-2', isActive: true });
    });

    (prisma.auditLog.create as any).mockResolvedValue({ id: 'aud-1' });
  });

  describe('PUT /api/v1/gamingCenters/:gamingCenterId/settings', () => {
    it('should successfully update settings via PUT and NOT return 501 CMS routes placeholder', async () => {
      const mockUpdated = {
        id: 's-1',
        gamingCenterId: 'gc-1',
        allowOnlineBooking: true,
        onlineBookingAutoConfirm: true,
        preventOverlaps: true,
        workStartTime: '09:00',
        workEndTime: '23:00',
        timeZone: 'Asia/Tehran',
      };

      (prisma.settings.findUnique as any).mockResolvedValue(null);
      (prisma.settings.upsert as any).mockResolvedValue(mockUpdated);
      (prisma.gamingCenter.update as any).mockResolvedValue({ id: 'gc-1' });

      const res = await request(app)
        .put('/api/v1/gamingCenters/gc-1/settings')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
        .send({
          allowOnlineBooking: true,
          onlineBookingAutoConfirm: true,
          preventOverlaps: true,
          workStartTime: '09:00',
          workEndTime: '23:00',
          timeZone: 'Asia/Tehran',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.allowOnlineBooking).toBe(true);
      expect(res.body.data.onlineBookingAutoConfirm).toBe(true);
      expect(res.body.data.preventOverlaps).toBe(true);
      expect(res.body.data.workStartTime).toBe('09:00');
      expect(res.body.data.workEndTime).toBe('23:00');
    });

    it('should enforce tenant isolation and deny other gaming center manager', async () => {
      const res = await request(app)
        .put('/api/v1/gamingCenters/gc-1/settings')
        .set('Authorization', `Bearer ${OTHER_MANAGER_TOKEN}`)
        .send({
          allowOnlineBooking: true,
        });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/gamingCenters/:gamingCenterId/settings', () => {
    it('should update partial settings via PATCH', async () => {
      const mockUpdated = {
        id: 's-1',
        gamingCenterId: 'gc-1',
        allowOnlineBooking: false,
        onlineBookingAutoConfirm: false,
        preventOverlaps: false,
      };

      (prisma.settings.findUnique as any).mockResolvedValue(null);
      (prisma.settings.upsert as any).mockResolvedValue(mockUpdated);

      const res = await request(app)
        .patch('/api/v1/gamingCenters/gc-1/settings')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
        .send({
          preventOverlaps: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.preventOverlaps).toBe(false);
    });
  });

  describe('GET /api/v1/gamingCenters/:gamingCenterId/settings', () => {
    it('should return settings for manager', async () => {
      const mockSettings = {
        id: 's-1',
        gamingCenterId: 'gc-1',
        allowOnlineBooking: true,
        onlineBookingAutoConfirm: false,
        preventOverlaps: true,
        workStartTime: '10:00',
        workEndTime: '22:00',
        timeZone: 'Asia/Tehran',
      };

      (prisma.settings.findUnique as any).mockResolvedValue(mockSettings);

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/settings')
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workStartTime).toBe('10:00');
    });
  });
});
