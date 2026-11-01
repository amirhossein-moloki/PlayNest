/* eslint-disable @typescript-eslint/no-explicit-any */
import express from 'express';
import request from 'supertest';
import argon2 from 'argon2';
import { prisma } from '../../../src/config/prisma';
import { authenticatePlatformAdmin } from '../../../src/platform-admin/auth/admin.authenticate';
import { requireAdminSession } from '../../../src/platform-admin/auth/admin.authorization';
import { getReadOnlyResources } from '../../../src/platform-admin/resources/read-only.resources';
import { getSafeCrudResources } from '../../../src/platform-admin/resources/safe-crud.resources';
import { buildResourceRegistry } from '../../../src/platform-admin/resources/resource.registry';
import { DashboardService } from '../../../src/platform-admin/dashboard/dashboard.service';
import { AdminHealthService } from '../../../src/platform-admin/services/admin-health.service';
import redis from '../../../src/config/redis';

jest.mock('../../../src/config/redis', () => ({
  ping: jest.fn().mockResolvedValue('PONG'),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  on: jest.fn(),
}));

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    platformAdmin: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    gamingCenter: {
      count: jest.fn().mockResolvedValue(12),
    },
    user: {
      count: jest.fn().mockResolvedValue(150),
    },
    reservation: {
      count: jest.fn().mockImplementation((args?: any) => {
        if (args?.where?.status === 'CONFIRMED') return Promise.resolve(45);
        if (args?.where?.status === 'COMPLETED') return Promise.resolve(300);
        if (args?.where?.status === 'CANCELED') return Promise.resolve(15);
        return Promise.resolve(360);
      }),
    },
    payment: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { amount: 50000000 },
        _count: { id: 250 },
      }),
      count: jest.fn().mockResolvedValue(8),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'log_1',
          action: 'PLATFORM_ADMIN_PANEL_LOGIN',
          entity: 'PlatformAdmin',
          entityId: 'pa_1',
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
      ]),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  },
}));

jest.mock('../../../src/modules/audit/audit.station', () => ({
  auditService: {
    recordLog: jest.fn().mockResolvedValue({ id: 'audit_rec_1' }),
  },
}));

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

const MockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe('PlayNest Platform Admin Panel - Phase 1 Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. PlatformAdmin Authentication', () => {
    const validAdmin = {
      id: 'pa_test_1',
      fullName: 'Super Administrator',
      phone: '09121112233',
      email: 'admin@playnest.ir',
      passwordHash: 'secure_hash',
      isActive: true,
      isSuperuser: true,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should authenticate a valid active superuser PlatformAdmin by email', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue(validAdmin);
      MockedArgon2.verify.mockResolvedValue(true as any);
      (prisma.platformAdmin.update as jest.Mock).mockResolvedValue({ ...validAdmin, lastLogin: new Date() });

      const user = await authenticatePlatformAdmin('admin@playnest.ir', 'StrongPass123!');

      expect(user).toBeDefined();
      expect(user?.id).toBe(validAdmin.id);
      expect(user?.email).toBe(validAdmin.email);
      expect(user?.isSuperuser).toBe(true);
      expect((user as any)?.passwordHash).toBeUndefined();
      expect(prisma.platformAdmin.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: validAdmin.id } })
      );
    });

    it('should authenticate a valid active superuser PlatformAdmin by phone', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue(validAdmin);
      MockedArgon2.verify.mockResolvedValue(true as any);
      (prisma.platformAdmin.update as jest.Mock).mockResolvedValue({ ...validAdmin, lastLogin: new Date() });

      const user = await authenticatePlatformAdmin('09121112233', 'StrongPass123!');

      expect(user).toBeDefined();
      expect(user?.id).toBe(validAdmin.id);
      expect(user?.phone).toBe(validAdmin.phone);
    });

    it('should reject login with an invalid password', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue(validAdmin);
      MockedArgon2.verify.mockResolvedValue(false as any);

      const user = await authenticatePlatformAdmin('admin@playnest.ir', 'WrongPassword!');

      expect(user).toBeNull();
      expect(prisma.platformAdmin.update).not.toHaveBeenCalled();
    });

    it('should reject an inactive PlatformAdmin account', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue({
        ...validAdmin,
        isActive: false,
      });

      const user = await authenticatePlatformAdmin('admin@playnest.ir', 'StrongPass123!');

      expect(user).toBeNull();
      expect(MockedArgon2.verify).not.toHaveBeenCalled();
    });

    it('should reject a non-superuser PlatformAdmin account', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue({
        ...validAdmin,
        isSuperuser: false,
      });

      const user = await authenticatePlatformAdmin('admin@playnest.ir', 'StrongPass123!');

      expect(user).toBeNull();
      expect(MockedArgon2.verify).not.toHaveBeenCalled();
    });

    it('should return null when admin record does not exist', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue(null);

      const user = await authenticatePlatformAdmin('unknown@playnest.ir', 'AnyPass123!');

      expect(user).toBeNull();
    });
  });

  describe('2. Server-side Route Authorization Middleware', () => {
    let testApp: express.Express;

    beforeEach(() => {
      testApp = express();
      testApp.use(express.json());

      // Mock session middleware
      testApp.use((req: any, _res, next) => {
        const sessionRole = req.headers['x-test-session'];
        if (sessionRole === 'admin') {
          req.session = {
            adminUser: {
              id: 'pa_123',
              fullName: 'Admin User',
              email: 'admin@playnest.ir',
              phone: '09121112233',
              isSuperuser: true,
            },
          };
        } else if (sessionRole === 'non-superuser') {
          req.session = {
            adminUser: {
              id: 'pa_456',
              fullName: 'Regular Admin',
              isSuperuser: false,
            },
          };
        } else {
          req.session = {};
        }
        next();
      });

      testApp.use('/platform-admin-panel', requireAdminSession);
      testApp.get('/platform-admin-panel', (_req, res) => {
        res.status(200).json({ message: 'Welcome to Platform Admin Panel' });
      });
      testApp.get('/platform-admin-panel/login', (_req, res) => {
        res.status(200).send('Login Page');
      });
    });

    it('should allow public access to the login page', async () => {
      const res = await request(testApp).get('/platform-admin-panel/login');
      expect(res.status).toBe(200);
      expect(res.text).toBe('Login Page');
    });

    it('should redirect unauthenticated browser requests to login', async () => {
      const res = await request(testApp).get('/platform-admin-panel');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/platform-admin-panel/login');
    });

    it('should return 401 for unauthenticated JSON API requests', async () => {
      const res = await request(testApp)
        .get('/platform-admin-panel')
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Unauthorized');
    });

    it('should reject session if user is not a superuser', async () => {
      const res = await request(testApp)
        .get('/platform-admin-panel')
        .set('x-test-session', 'non-superuser')
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
    });

    it('should allow access when a valid PlatformAdmin session exists', async () => {
      const res = await request(testApp)
        .get('/platform-admin-panel')
        .set('x-test-session', 'admin');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Welcome to Platform Admin Panel');
    });
  });

  describe('3. Resource Registry and Read-Only Enforcement', () => {
    it('should enforce write-protection on all financial and operational models', () => {
      const readOnlyResources = getReadOnlyResources();
      const readOnlyModelNames = [
        'Reservation',
        'GroupBooking',
        'Payment',
        'Refund',
        'LedgerEntry',
        'WalletTransaction',
        'AuditLog',
      ];

      expect(readOnlyResources.length).toBe(readOnlyModelNames.length);

      for (const res of readOnlyResources) {
        const modelName = res.resource.model.name;
        expect(readOnlyModelNames).toContain(modelName);

        // Verify actions: new, edit, delete, and bulkDelete are all disabled
        const { actions } = res.options;
        expect(actions.new.isAccessible).toBe(false);
        expect(actions.new.isVisible).toBe(false);

        expect(actions.edit.isAccessible).toBe(false);
        expect(actions.edit.isVisible).toBe(false);

        expect(actions.delete.isAccessible).toBe(false);
        expect(actions.delete.isVisible).toBe(false);

        expect(actions.bulkDelete.isAccessible).toBe(false);
        expect(actions.bulkDelete.isVisible).toBe(false);
      }
    });

    it('should configure Safe CRUD models with operations enabled', () => {
      const safeCrudResources = getSafeCrudResources();
      const expectedModels = ['Category', 'Tag', 'SiteSettings'];

      expect(safeCrudResources.length).toBe(expectedModels.length);

      for (const res of safeCrudResources) {
        const modelName = res.resource.model.name;
        expect(expectedModels).toContain(modelName);
        expect(res.options.navigation.name).toBe('Content Management');
        // Verify default actions are NOT disabled
        expect(res.options.actions?.new?.isAccessible).toBeUndefined();
      }
    });

    it('should build complete explicit registry with sensitive properties hidden', () => {
      const allResources = buildResourceRegistry();
      expect(allResources.length).toBeGreaterThanOrEqual(13);

      for (const res of allResources) {
        expect(res.resource.model).toBeDefined();
        expect(res.resource.client).toBeDefined();

        // Check passwordHash property is masked
        if (res.options.properties?.passwordHash) {
          expect(res.options.properties.passwordHash.isVisible.list).toBe(false);
          expect(res.options.properties.passwordHash.isVisible.show).toBe(false);
          expect(res.options.properties.passwordHash.isVisible.edit).toBe(false);
        }
      }
    });
  });

  describe('4. Dashboard Aggregation and Health Services', () => {
    it('should aggregate platform metrics correctly from Prisma and Health services', async () => {
      const metrics = await DashboardService.getPlatformMetrics();

      expect(metrics.totalGamingCenters).toBe(12);
      expect(metrics.totalUsers).toBe(150);
      expect(metrics.reservations.total).toBe(360);
      expect(metrics.reservations.confirmed).toBe(45);
      expect(metrics.reservations.completed).toBe(300);
      expect(metrics.reservations.canceled).toBe(15);
      expect(metrics.payments.totalVolume).toBe(50000000);
      expect(metrics.payments.successfulCount).toBe(250);
      expect(metrics.payments.failedCount).toBe(8);
      expect(metrics.recentAuditLogs.length).toBe(1);
      expect(metrics.health.database.status).toBe('UP');
      expect(metrics.health.redis.status).toBe('UP');
    });

    it('should report database and redis health status', async () => {
      const health = await AdminHealthService.checkHealth();

      expect(health.database.status).toBe('UP');
      expect(health.redis.status).toBe('UP');
      expect(health.timestamp).toBeDefined();
      expect(redis.ping).toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });
});
