/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import { env } from '../../../src/config/env';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    settings: {
      findUnique: jest.fn(),
    },
    gamingCenterAnalytics: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    staffAnalytics: {
      groupBy: jest.fn(),
    },
    stationAnalytics: {
      groupBy: jest.fn(),
    },
    reservation: {
      groupBy: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    payment: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    refund: {
      groupBy: jest.fn(),
    },
    ledgerEntry: {
      groupBy: jest.fn(),
    },
    waitlistEntry: {
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    waitlistOffer: {
      groupBy: jest.fn(),
    },
    notificationLog: {
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    customerProfile: {
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    gameStation: {
      findMany: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
    analyticsWatermark: {
      findMany: jest.fn(),
    },
    analyticsIngestionRun: {
      findMany: jest.fn(),
    },
  },
}));

describe('Analytics API Integration Tests', () => {
  const SECRET = env.JWT_ACCESS_SECRET;
  const MANAGER_TOKEN = jwt.sign({ sessionId: 's-1', actorId: 'u-mgr', actorType: 'USER' }, SECRET);
  const STAFF_TOKEN = jwt.sign({ sessionId: 's-2', actorId: 'u-staff', actorType: 'USER' }, SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.session.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.tokenHash) {
        return Promise.resolve({ id: 's-1', actorId: 'u-mgr', actorType: 'USER', expiresAt: new Date(Date.now() + 3600000) });
      }
      return Promise.resolve(null);
    });

    (prisma.user.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === 'u-mgr') {
        return Promise.resolve({ id: 'u-mgr', role: 'MANAGER', gamingCenterId: 'gc-1' });
      }
      if (where.id === 'u-staff') {
        return Promise.resolve({ id: 'u-staff', role: 'STAFF', gamingCenterId: 'gc-1' });
      }
      return Promise.resolve(null);
    });

    (prisma.settings.findUnique as any).mockResolvedValue({ timeZone: 'UTC' });
    (prisma.analyticsWatermark.findMany as any).mockResolvedValue([]);
    (prisma.analyticsIngestionRun.findMany as any).mockResolvedValue([]);
  });

  describe('Authorization and Access Control', () => {
    it('should reject access to STAFF role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/analytics/summary')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${STAFF_TOKEN}`);

      expect(res.status).toBe(403);
    });

    it('should reject cross-tenant access attempt with 404 Not Found (Enumeration Defense)', async () => {
      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-2/analytics/summary')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(404);
    });

    it('should reject invalid date range (startDate > endDate) with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/analytics/summary?startDate=2026-02-01&endDate=2026-01-01')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/gamingCenters/:gamingCenterId/analytics/summary', () => {
    it('should return analytics summary successfully for MANAGER role', async () => {
      (prisma.gamingCenterAnalytics.aggregate as any).mockResolvedValue({
        _sum: { totalReservations: 5, completedReservations: 4, canceledReservations: 1, revenue: 500, realizedCash: 500 },
      });
      (prisma.reservation.groupBy as any).mockResolvedValue([
        { status: 'COMPLETED', _count: { _all: 4 }, _sum: { totalPrice: 500, totalHours: 8 } },
      ]);
      (prisma.reservation.count as any).mockResolvedValue(5);
      (prisma.customerProfile.count as any).mockResolvedValue(2);
      (prisma.payment.groupBy as any).mockResolvedValue([
        { currency: 'IRR', _sum: { amount: 500 }, _count: { _all: 4 } },
      ]);

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/analytics/summary')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalReservations).toBe(5);
      expect(res.body.data.period.timeZone).toBe('UTC');
    });
  });

  describe('GET /api/v1/gamingCenters/:gamingCenterId/analytics/reservations', () => {
    it('should return detailed reservation metrics report', async () => {
      (prisma.reservation.groupBy as any).mockResolvedValue([
        { status: 'COMPLETED', _count: { _all: 4 }, _sum: { totalPrice: 400, totalHours: 8 } },
      ]);
      (prisma.reservation.count as any).mockResolvedValue(4);
      (prisma.reservation.findMany as any).mockResolvedValue([]);
      (prisma.gameStation.findMany as any).mockResolvedValue([
        { id: 'st-1', name: 'PC 1', stationType: 'PC', isActive: true, hourlyPrice: 50 },
      ]);

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/analytics/reservations')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalReservations).toBe(4);
      expect(res.body.data.metrics.completionRate).toBe(100);
    });
  });

  describe('GET /api/v1/gamingCenters/:gamingCenterId/analytics/financials', () => {
    it('should return multi-currency safe financial report', async () => {
      (prisma.payment.groupBy as any).mockResolvedValue([
        { currency: 'IRR', _sum: { amount: 100000 }, _count: { _all: 2 } },
      ]);
      (prisma.refund.groupBy as any).mockResolvedValue([
        { currency: 'IRR', _sum: { amount: 10000 }, _count: { _all: 1 } },
      ]);
      (prisma.ledgerEntry.groupBy as any).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/analytics/financials?currency=IRR')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.currency).toBe('IRR');
      expect(res.body.data.summary.grossCollected).toBe(100000);
      expect(res.body.data.summary.totalRefunded).toBe(10000);
      expect(res.body.data.summary.netCollected).toBe(90000);
    });
  });

  describe('GET /api/v1/gamingCenters/:gamingCenterId/analytics/operations/waitlist', () => {
    it('should return waitlist operational insights', async () => {
      (prisma.waitlistEntry.groupBy as any).mockResolvedValue([
        { status: 'CONVERTED', _count: { _all: 2 } },
      ]);
      (prisma.waitlistOffer.groupBy as any).mockResolvedValue([
        { status: 'ACCEPTED', _count: { _all: 2 } },
      ]);
      (prisma.waitlistEntry.count as any).mockResolvedValue(2);

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/analytics/operations/waitlist')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalEntries).toBe(2);
      expect(res.body.data.conversionRate).toBe(100);
    });
  });

  describe('GET /api/v1/gamingCenters/:gamingCenterId/analytics/operations/notifications', () => {
    it('should return notification dispatch and failure summaries', async () => {
      (prisma.notificationLog.groupBy as any).mockResolvedValue([
        { status: 'SENT', _count: { _all: 5 } },
      ]);
      (prisma.notificationLog.count as any).mockResolvedValue(5);

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/analytics/operations/notifications')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalLogs).toBe(5);
      expect(res.body.data.failureRate).toBe(0);
    });
  });

  describe('GET /api/v1/gamingCenters/:gamingCenterId/analytics/ingestion-status', () => {
    it('should return ingestion status and watermark positions', async () => {
      (prisma.analyticsWatermark.findMany as any).mockResolvedValue([
        { entity: 'Reservation', lastIngestedAt: new Date('2026-02-01T10:00:00Z'), lastSourceId: 'res-1' },
      ]);
      (prisma.analyticsIngestionRun.findMany as any).mockResolvedValue([
        { id: 'run-1', entity: 'Reservation', status: 'SUCCESS', recordsRead: 10, recordsIngested: 10, durationMs: 120, startedAt: new Date(), completedAt: new Date() },
      ]);

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/analytics/ingestion-status')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('FRESH');
      expect(res.body.data.watermarks.length).toBe(1);
    });
  });

  describe('Owner Dashboard UI Routes', () => {
    it('should render HTML dashboard for MANAGER role at /gamingCenters/:gamingCenterId/dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/dashboard')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Internal Management Dashboard');
    });

    it('should render HTML dashboard for MANAGER role at /admin/gamingCenters/:gamingCenterId/dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/admin/gamingCenters/gc-1/dashboard')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${MANAGER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Internal Management Dashboard');
    });

    it('should reject access to dashboard for STAFF role with 403', async () => {
      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/dashboard')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${STAFF_TOKEN}`);

      expect(res.status).toBe(403);
    });
  });
});
