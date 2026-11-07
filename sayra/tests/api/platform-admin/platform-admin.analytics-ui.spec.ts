/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';

jest.mock('../../../src/config/redis', () => ({
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  del: jest.fn().mockImplementation(() => Promise.resolve(1)),
}));

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    platformAdmin: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    platformSetting: {
      findUnique: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    gameStation: {
      count: jest.fn(),
    },
    reservation: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    refund: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    earning: {
      aggregate: jest.fn(),
    },
    customerAccount: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    gamingSession: {
      count: jest.fn(),
    },
    ticket: {
      count: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('Platform Analytics UI & API Tests', () => {
  const superuserToken = generateAccessToken({
    sessionId: 'sess_admin_analytics',
    actorId: 'pa_admin_123',
    actorType: 'PLATFORM_ADMIN',
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/platform-admin/analytics/dashboard (UI Page)', () => {
    it('should serve the standalone platform analytics HTML dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/platform-admin/analytics/dashboard');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
      expect(res.text).toContain('PlayNest - Platform Analytics Dashboard');
      expect(res.text).toContain('Overview Dashboard');
      expect(res.text).toContain('Financial Analytics');
      expect(res.text).toContain('Gaming Center Performance');
      expect(res.text).toContain('Reservation Analytics');
      expect(res.text).toContain('User Analytics');
      expect(res.text).toContain('Device Analytics');
      expect(res.text).toContain('/api/v1/platform-admin/analytics/reports');
    });

    it('should have navigation links between global overview and platform analytics', async () => {
      const overviewRes = await request(app)
        .get('/api/v1/platform-admin/dashboard');

      expect(overviewRes.status).toBe(200);
      expect(overviewRes.text).toContain('/api/v1/platform-admin/analytics/dashboard');

      const analyticsRes = await request(app)
        .get('/api/v1/platform-admin/analytics/dashboard');

      expect(analyticsRes.status).toBe(200);
      expect(analyticsRes.text).toContain('/api/v1/platform-admin/dashboard');
    });
  });

  describe('GET /api/v1/platform-admin/analytics/reports (API Data Integration)', () => {
    it('should require superuser authentication', async () => {
      const res = await request(app)
        .get('/api/v1/platform-admin/analytics/reports');

      expect([401, 403]).toContain(res.status);
    });

    it('should return aggregated platform report structure for superuser', async () => {
      (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue({
        id: 'pa_admin_123',
        fullName: 'Global Admin',
        phone: '09121112233',
        isActive: true,
      });

      (prisma.payment.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 5000000 },
      });
      (prisma.refund.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 200000 },
      });
      (prisma.reservation.aggregate as jest.Mock).mockResolvedValue({
        _sum: { discountAmount: 100000 },
        _avg: { totalHours: 2.5 },
      });
      (prisma.earning.aggregate as jest.Mock).mockResolvedValue({
        _sum: { commissionAmount: 250000 },
      });
      (prisma.reservation.count as jest.Mock).mockResolvedValue(12);
      (prisma.customerAccount.count as jest.Mock).mockResolvedValue(50);
      (prisma.customerAccount.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.gamingCenter.count as jest.Mock).mockResolvedValue(4);
      (prisma.gameStation.count as jest.Mock).mockResolvedValue(40);
      (prisma.reservation.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/platform-admin/analytics/reports')
        .set('Authorization', `Bearer ${superuserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('period');
      expect(res.body.data).toHaveProperty('financials');
      expect(res.body.data).toHaveProperty('reservations');
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data).toHaveProperty('gamingCenters');
      expect(res.body.data).toHaveProperty('timeSeries');

      expect(res.body.data.financials.totalPaidAmount).toBe(5000000);
      expect(res.body.data.financials.totalRefundAmount).toBe(200000);
      expect(res.body.data.financials.totalRevenue).toBe(4800000);
      expect(res.body.data.financials.platformCommission).toBe(250000);
      expect(res.body.data.financials.gamingCentersRevenue).toBe(4550000);
    });
  });
});
