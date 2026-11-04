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
    },
    discountCampaign: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    discountUsage: {
      count: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    platformSetting: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    session: {
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    payment: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    refund: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    reservation: {
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    gameStation: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    earning: {
      aggregate: jest.fn(),
    },
    $extends: jest.fn().mockReturnThis(),
    $transaction: jest.fn(),
  },
}));

describe('Platform Admin Full Modules API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const platformAdminToken = generateAccessToken({
    sessionId: 'sess_admin_test',
    actorId: 'pa_test_1',
    actorType: 'PLATFORM_ADMIN',
  });

  beforeEach(() => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_test_1',
      fullName: 'Global Admin',
      isActive: true,
      isSuperuser: true,
    });
    ((prisma as any).platformSetting.findUnique as jest.Mock).mockResolvedValue({
      id: 'default',
      maintenanceMode: false,
    });
  });

  describe('MODULE 1: Platform-wide Campaigns & Discounts', () => {
    it('GET /platform-admin/campaigns should list campaigns with pagination', async () => {
      const mockCampaign = {
        id: 'camp_1',
        title: 'Spring Festival',
        name: 'Spring Festival',
        code: 'SPRING2026',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        scopeType: 'GLOBAL',
        targetAudience: 'ALL_USERS',
        startAt: new Date('2026-03-20T00:00:00Z'),
        endAt: new Date('2026-04-20T00:00:00Z'),
        status: 'ACTIVE',
        isActive: true,
        currentUsageCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      ((prisma as any).discountCampaign.findMany as jest.Mock).mockResolvedValue([mockCampaign]);
      ((prisma as any).discountCampaign.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/platform-admin/campaigns')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].code).toBe('SPRING2026');
      expect(res.body.data[0].discountType).toBe('PERCENTAGE');
      expect(res.body.data[0].discountValue).toBe(20);
      expect(res.body.meta.pagination.totalItems).toBe(1);
    });

    it('POST /platform-admin/campaigns should create campaign with validations', async () => {
      ((prisma as any).discountCampaign.findFirst as jest.Mock).mockResolvedValue(null);
      ((prisma as any).discountCampaign.create as jest.Mock).mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'camp_new',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          currentUsageCount: 0,
        });
      });

      const res = await request(app)
        .post('/api/v1/platform-admin/campaigns')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          title: 'Summer Blast',
          code: 'SUMMER50',
          discountType: 'PERCENTAGE',
          discountValue: 50,
          maxDiscountAmount: 500000,
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-06-30T00:00:00.000Z',
          scopeType: 'GLOBAL',
          targetAudience: 'ALL_USERS',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe('SUMMER50');
      expect(res.body.data.discountValue).toBe(50);
    });

    it('POST /platform-admin/campaigns should reject duplicate discount code', async () => {
      ((prisma as any).discountCampaign.findFirst as jest.Mock).mockResolvedValue({
        id: 'camp_existing',
        code: 'SUMMER50',
      });

      const res = await request(app)
        .post('/api/v1/platform-admin/campaigns')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          title: 'Summer Blast Duplicate',
          code: 'SUMMER50',
          discountType: 'PERCENTAGE',
          discountValue: 30,
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-06-30T00:00:00.000Z',
        });

      expect(res.status).toBe(409);
    });

    it('PATCH /platform-admin/campaigns/:id should update campaign details', async () => {
      ((prisma as any).discountCampaign.findFirst as jest.Mock).mockResolvedValue({
        id: 'camp_1',
        title: 'Old Title',
        code: 'OLDCODE',
        currentUsageCount: 0,
        startAt: new Date('2026-01-01'),
        endAt: new Date('2026-01-10'),
      });
      ((prisma as any).discountCampaign.update as jest.Mock).mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'camp_1',
          name: data.title || 'New Title',
          title: data.title || 'New Title',
          code: data.code || 'OLDCODE',
          discountType: 'PERCENTAGE',
          discountValue: 15,
          currentUsageCount: 0,
          startAt: new Date('2026-01-01'),
          endAt: new Date('2026-01-10'),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      const res = await request(app)
        .patch('/api/v1/platform-admin/campaigns/camp_1')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          title: 'New Title',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('New Title');
    });

    it('DELETE /platform-admin/campaigns/:id should soft delete campaign', async () => {
      ((prisma as any).discountCampaign.findFirst as jest.Mock).mockResolvedValue({
        id: 'camp_1',
        currentUsageCount: 3,
      });
      ((prisma as any).discountUsage.count as jest.Mock).mockResolvedValue(3);
      ((prisma as any).discountCampaign.update as jest.Mock).mockResolvedValue({
        id: 'camp_1',
        deletedAt: new Date(),
      });

      const res = await request(app)
        .delete('/api/v1/platform-admin/campaigns/camp_1')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('Campaign deleted');
    });
  });

  describe('MODULE 2: Platform Global Settings & Maintenance Mode', () => {
    it('GET /platform-admin/settings should return settings and live infrastructure status', async () => {
      ((prisma as any).platformSetting.findUnique as jest.Mock).mockResolvedValue({
        id: 'default',
        siteTitle: 'PlayNest Central',
        supportPhone: '02188888888',
        supportEmail: 'support@playnest.com',
        maintenanceMode: false,
        platformCommissionPercent: 5,
        reviewApprovalPolicy: 'AUTO',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/v1/platform-admin/settings')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.settings.siteTitle).toBe('PlayNest Central');
      expect(res.body.data.infrastructure).toBeDefined();
      expect(res.body.data.infrastructure.apiVersion).toBeDefined();
    });

    it('PUT /platform-admin/settings should validate and update global settings', async () => {
      ((prisma as any).platformSetting.upsert as jest.Mock).mockResolvedValue({
        id: 'default',
        siteTitle: 'PlayNest Updated',
        supportPhone: '02199999999',
        supportEmail: 'contact@playnest.com',
        maintenanceMode: false,
        platformCommissionPercent: 7.5,
        maxAdvanceBookingDays: 20,
        reviewApprovalPolicy: 'MANUAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .put('/api/v1/platform-admin/settings')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          siteTitle: 'PlayNest Updated',
          supportPhone: '02199999999',
          supportEmail: 'contact@playnest.com',
          platformCommissionPercent: 7.5,
          maxAdvanceBookingDays: 20,
          reviewApprovalPolicy: 'MANUAL',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.siteTitle).toBe('PlayNest Updated');
      expect(res.body.data.platformCommissionPercent).toBe(7.5);
      expect(res.body.data.reviewApprovalPolicy).toBe('MANUAL');
    });

    it('PUT /platform-admin/settings should reject invalid commission percentages', async () => {
      const res = await request(app)
        .put('/api/v1/platform-admin/settings')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          platformCommissionPercent: 120, // Exceeds 100
        });

      expect(res.status).toBe(400);
    });
  });

  describe('MODULE 3: Complete Users & Gaming Centers CRUD', () => {
    it('POST /platform-admin/users should create a manager with hashed password', async () => {
      ((prisma as any).gamingCenter.findUnique as jest.Mock).mockResolvedValue({ id: 'gc_target_1' });
      ((prisma as any).user.findFirst as jest.Mock).mockResolvedValue(null);
      ((prisma as any).user.create as jest.Mock).mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'user_created_1',
          ...data,
          passwordHash: 'hashed_pw',
          gamingCenter: { id: 'gc_target_1', name: 'Arena 1', slug: 'arena-1' },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      const res = await request(app)
        .post('/api/v1/platform-admin/users')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          gamingCenterId: 'gc_target_1',
          firstName: 'Reza',
          lastName: 'Abbasi',
          phone: '09123456789',
          email: 'reza@arena1.com',
          password: 'Password123!',
          role: 'MANAGER',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('user_created_1');
      expect(res.body.data.fullName).toBe('Reza Abbasi');
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('PATCH /platform-admin/users/:id should update user identity', async () => {
      ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_1',
        gamingCenterId: 'gc_target_1',
        fullName: 'Old Name',
        phone: '09121111111',
      });
      ((prisma as any).user.update as jest.Mock).mockResolvedValue({
        id: 'user_1',
        gamingCenterId: 'gc_target_1',
        fullName: 'New First New Last',
        phone: '09121111111',
        isActive: true,
      });

      const res = await request(app)
        .patch('/api/v1/platform-admin/users/user_1')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          firstName: 'New First',
          lastName: 'New Last',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('New First New Last');
    });

    it('DELETE /platform-admin/users/:id should soft delete user when transactions exist', async () => {
      ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_1',
        gamingCenterId: 'gc_target_1',
        fullName: 'Busy Manager',
        isActive: true,
      });
      ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(10);
      ((prisma as any).user.update as jest.Mock).mockResolvedValue({
        id: 'user_1',
        isActive: false,
      });

      const res = await request(app)
        .delete('/api/v1/platform-admin/users/user_1')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deactivated).toBe(true);
    });

    it('GET /platform-admin/gaming-centers should return gaming centers with owner and address', async () => {
      const mockCenter = {
        id: 'gc_arena',
        name: 'Alpha Arena',
        slug: 'alpha-arena',
        isActive: true,
        users: [
          {
            id: 'owner_1',
            fullName: 'Ali Rezaei',
            phone: '09120000001',
            email: 'ali@arena.com',
          },
        ],
        addresses: [
          {
            id: 'addr_1',
            title: 'Main Branch',
            city: 'Tehran',
            province: 'Tehran',
            addressLine: 'Valiasr St',
            postalCode: '1234567890',
            lat: 35.7,
            lng: 51.4,
          },
        ],
        _count: { users: 3, stations: 15, reservations: 100 },
      };

      ((prisma as any).gamingCenter.findMany as jest.Mock).mockResolvedValue([mockCenter]);
      ((prisma as any).gamingCenter.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/platform-admin/gaming-centers')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Alpha Arena');
      expect(res.body.data[0].owner).toBeDefined();
      expect(res.body.data[0].owner.fullName).toBe('Ali Rezaei');
      expect(res.body.data[0].address).toBeDefined();
      expect(res.body.data[0].address.city).toBe('Tehran');
    });
  });

  describe('MODULE 4: Platform Aggregated Analytics & Reports', () => {
    it('GET /platform-admin/analytics/reports should calculate metrics and period comparison', async () => {
      // Payments aggregate
      ((prisma as any).payment.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 15000000 },
      });
      // Refunds aggregate
      ((prisma as any).refund.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 1000000 },
      });
      // Reservation aggregates & counts
      ((prisma as any).reservation.aggregate as jest.Mock).mockResolvedValue({
        _sum: { discountAmount: 500000 },
        _avg: { totalHours: 2.5 },
      });
      ((prisma as any).earning.aggregate as jest.Mock).mockResolvedValue({
        _sum: { commissionAmount: 1400000 },
      });
      ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(50);
      ((prisma as any).customerAccount.count as jest.Mock).mockResolvedValue(200);
      ((prisma as any).reservation.groupBy as jest.Mock).mockResolvedValue([{ customerAccountId: 'c1', _count: { id: 1 } }]);
      ((prisma as any).gamingCenter.count as jest.Mock).mockResolvedValue(5);
      ((prisma as any).gameStation.count as jest.Mock).mockResolvedValue(40);
      ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([]);
      ((prisma as any).payment.findMany as jest.Mock).mockResolvedValue([]);
      ((prisma as any).customerAccount.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/platform-admin/analytics/reports?compare=true&period=MONTHLY')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.financials.totalPaidAmount).toBe(15000000);
      expect(res.body.data.financials.totalRefundAmount).toBe(1000000);
      expect(res.body.data.financials.totalRevenue).toBe(14000000);
      expect(res.body.data.reservations.totalReservations).toBe(50);
      expect(res.body.data.comparison).toBeDefined();
    });
  });
});
