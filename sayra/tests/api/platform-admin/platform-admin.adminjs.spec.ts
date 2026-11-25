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
import { encryptTotpSecret, generateTotpCode, generateTotpSecret } from '../../../src/modules/auth/totp.crypto';
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
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    platformAdminAuthenticator: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    refund: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { amount: 2000000 },
        _count: { id: 2 },
      }),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'log_1',
          action: 'ADMIN_LOGIN_SUCCESS',
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

describe('PlayNest Platform Admin Panel - Mandatory TOTP & Security Test Suite', () => {
  const totpSecret = generateTotpSecret();
  const totpCipher = encryptTotpSecret(totpSecret, 'pa_test_1');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. PlatformAdmin TOTP Authentication', () => {
    const validAdmin = {
      id: 'pa_test_1',
      username: 'superadmin',
      fullName: 'Super Administrator',
      phone: '09121112233',
      email: 'admin@playnest.ir',
      passwordHash: 'secure_hash',
      isActive: true,
      isSuperuser: true,
      totpEnabled: true,
      totpSetupCompleted: true,
      totpSecretEncrypted: totpCipher,
      totpLastUsedStep: null,
      authenticators: [
        {
          id: 'auth_panel_1',
          secretEncrypted: totpCipher,
          status: 'ACTIVE',
          lastUsedStep: null,
        },
      ],
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should authenticate a valid active superuser PlatformAdmin by username with valid TOTP', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue(validAdmin);
      MockedArgon2.verify.mockResolvedValue(true as any);
      (prisma.platformAdminAuthenticator.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.platformAdmin.update as jest.Mock).mockResolvedValue({ ...validAdmin, lastLogin: new Date() });

      const validCode = generateTotpCode(totpSecret);
      const user = await authenticatePlatformAdmin('superadmin', 'StrongPass123!', validCode);

      expect(user).toBeDefined();
      expect(user?.id).toBe(validAdmin.id);
      expect(user?.username).toBe('superadmin');
      expect(user?.mfaVerified).toBe(true);
      expect(user?.isSuperuser).toBe(true);
      expect((user as any)?.passwordHash).toBeUndefined();
      expect(prisma.platformAdmin.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: validAdmin.id } })
      );
    });

    it('should authenticate a valid active superuser PlatformAdmin by phone with valid TOTP', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue(validAdmin);
      MockedArgon2.verify.mockResolvedValue(true as any);
      (prisma.platformAdminAuthenticator.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.platformAdmin.update as jest.Mock).mockResolvedValue({ ...validAdmin, lastLogin: new Date() });

      const validCode = generateTotpCode(totpSecret);
      const user = await authenticatePlatformAdmin('09121112233', 'StrongPass123!', validCode);

      expect(user).toBeDefined();
      expect(user?.id).toBe(validAdmin.id);
      expect(user?.phone).toBe(validAdmin.phone);
      expect(user?.mfaVerified).toBe(true);
    });

    it('should reject password-only login when TOTP code is missing', async () => {
      const user = await authenticatePlatformAdmin('superadmin', 'StrongPass123!');
      expect(user).toBeNull();
      expect(prisma.platformAdmin.update).not.toHaveBeenCalled();
    });

    it('should reject login when TOTP is not yet configured on the admin account', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue({
        ...validAdmin,
        totpEnabled: false,
        totpSetupCompleted: false,
      });
      MockedArgon2.verify.mockResolvedValue(true as any);

      const user = await authenticatePlatformAdmin('superadmin', 'StrongPass123!', '123456');
      expect(user).toBeNull();
      expect(prisma.platformAdmin.update).not.toHaveBeenCalled();
    });

    it('should reject login with an invalid TOTP code', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue(validAdmin);
      MockedArgon2.verify.mockResolvedValue(true as any);

      const user = await authenticatePlatformAdmin('superadmin', 'StrongPass123!', '000000');
      expect(user).toBeNull();
      expect(prisma.platformAdmin.update).not.toHaveBeenCalled();
    });

    it('should reject login with an invalid password', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue(validAdmin);
      MockedArgon2.verify.mockResolvedValue(false as any);

      const validCode = generateTotpCode(totpSecret);
      const user = await authenticatePlatformAdmin('admin@playnest.ir', 'WrongPassword!', validCode);

      expect(user).toBeNull();
      expect(prisma.platformAdmin.update).not.toHaveBeenCalled();
    });

    it('should reject an inactive PlatformAdmin account', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue({
        ...validAdmin,
        isActive: false,
      });

      const validCode = generateTotpCode(totpSecret);
      const user = await authenticatePlatformAdmin('admin@playnest.ir', 'StrongPass123!', validCode);

      expect(user).toBeNull();
      expect(MockedArgon2.verify).not.toHaveBeenCalled();
    });

    it('should reject a non-superuser PlatformAdmin account', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue({
        ...validAdmin,
        isSuperuser: false,
      });

      const validCode = generateTotpCode(totpSecret);
      const user = await authenticatePlatformAdmin('admin@playnest.ir', 'StrongPass123!', validCode);

      expect(user).toBeNull();
      expect(MockedArgon2.verify).not.toHaveBeenCalled();
    });

    it('should return null when admin record does not exist', async () => {
      (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue(null);

      const user = await authenticatePlatformAdmin('unknown@playnest.ir', 'AnyPass123!', '123456');

      expect(user).toBeNull();
    });
  });

  describe('2. Server-side Route Authorization Middleware', () => {
    let testApp: express.Express;

    beforeEach(() => {
      testApp = express();
      testApp.use(express.json());

      testApp.use((req: any, _res, next) => {
        const sessionRole = req.headers['x-test-session'];
        if (sessionRole === 'admin') {
          req.session = {
            adminUser: {
              id: 'pa_123',
              username: 'superadmin',
              fullName: 'Admin User',
              email: 'admin@playnest.ir',
              phone: '09121112233',
              isSuperuser: true,
              mfaVerified: true,
            },
            destroy: (cb: () => void) => cb && cb(),
          };
        } else if (sessionRole === 'unverified-mfa') {
          req.session = {
            adminUser: {
              id: 'pa_123',
              fullName: 'Admin User',
              isSuperuser: true,
              mfaVerified: false,
            },
          };
        } else if (sessionRole === 'non-superuser') {
          req.session = {
            adminUser: {
              id: 'pa_456',
              fullName: 'Regular Admin',
              isSuperuser: false,
              mfaVerified: true,
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
      testApp.post('/platform-admin-panel/login', (_req, res) => {
        res.status(200).send('Should Not Reach');
      });
      testApp.get('/platform-admin-panel/frontend/assets/components.bundle.js', (_req, res) => {
        res.status(200).send('/* asset */');
      });
      testApp.get('/platform-admin-panel/admin.css', (_req, res) => {
        res.status(200).send('/* css */');
      });
      testApp.post('/platform-admin-panel/admin.css', (_req, res) => {
        res.status(200).send('Should Not Reach');
      });
      testApp.get('/platform-admin-panel/api/resources/User/actions/list', (_req, res) => {
        res.status(200).json({ users: [] });
      });
      testApp.post('/platform-admin-panel/api/resources/User/actions/new', (_req, res) => {
        res.status(201).json({ created: true });
      });
    });

    it('should allow public access to the login page and GET static assets', async () => {
      const loginRes = await request(testApp).get('/platform-admin-panel/login');
      expect(loginRes.status).toBe(200);
      expect(loginRes.text).toBe('Login Page');

      const bundleRes = await request(testApp).get('/platform-admin-panel/frontend/assets/components.bundle.js');
      expect(bundleRes.status).toBe(200);

      const cssRes = await request(testApp).get('/platform-admin-panel/admin.css');
      expect(cssRes.status).toBe(200);
    });

    it('should block query-string, method, and traversal bypass attempts on AdminJS routes', async () => {
      const qCssGet = await request(testApp)
        .get('/platform-admin-panel/api/resources/User/actions/list?/admin.css')
        .set('Accept', 'application/json');
      expect(qCssGet.status).toBe(401);

      const qAssetPost = await request(testApp)
        .post('/platform-admin-panel/api/resources/User/actions/new?/frontend/assets/x')
        .set('Accept', 'application/json');
      expect(qAssetPost.status).toBe(401);

      const postAsset = await request(testApp)
        .post('/platform-admin-panel/admin.css')
        .set('Accept', 'application/json');
      expect(postAsset.status).toBe(401);

      const postLogin = await request(testApp)
        .post('/platform-admin-panel/login')
        .set('Accept', 'application/json');
      expect(postLogin.status).toBe(401);

      const traversalGet = await request(testApp)
        .get('/platform-admin-panel/frontend/assets/../api/resources/User/actions/list')
        .set('Accept', 'application/json');
      expect(traversalGet.status).toBe(401);

      const encodedTraversalGet = await request(testApp)
        .get('/platform-admin-panel/frontend/assets/%2e%2e/api/resources/User/actions/list')
        .set('Accept', 'application/json');
      expect(encodedTraversalGet.status).toBe(401);
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

    it('should reject session if MFA verification was not completed', async () => {
      const res = await request(testApp)
        .get('/platform-admin-panel')
        .set('x-test-session', 'unverified-mfa')
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
    });

    it('should reject session if user is not a superuser', async () => {
      const res = await request(testApp)
        .get('/platform-admin-panel')
        .set('x-test-session', 'non-superuser')
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
    });

    it('should reject session if DB indicates 2FA setup is incomplete', async () => {
      (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue({
        id: 'pa_123',
        isActive: true,
        isSuperuser: true,
        totpEnabled: false,
        totpSetupCompleted: false,
      });

      const res = await request(testApp)
        .get('/platform-admin-panel')
        .set('x-test-session', 'admin')
        .set('Accept', 'application/json');

      expect(res.status).toBe(403);
    });

    it('should allow access when a valid MFA-verified PlatformAdmin session exists', async () => {
      (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue({
        id: 'pa_123',
        isActive: true,
        isSuperuser: true,
        totpEnabled: true,
        totpSetupCompleted: true,
      });

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
        'ReservationHistory',
        'StationMaintenance',
        'GroupBooking',
        'Payment',
        'Refund',
        'LedgerEntry',
        'WalletTransaction',
        'WithdrawalRequest',
        'CommissionPolicy',
        'Earning',
        'ReconciliationRecord',
        'AuditLog',
      ];

      expect(readOnlyResources.length).toBe(readOnlyModelNames.length);

      for (const res of readOnlyResources) {
        const modelName = res.resource.model.name;
        expect(readOnlyModelNames).toContain(modelName);

        const { actions } = res.options;
        expect(actions.new.isAccessible).toBe(false);
        expect(actions.edit.isAccessible).toBe(false);
        expect(actions.delete.isAccessible).toBe(false);
        expect(actions.bulkDelete.isAccessible).toBe(false);
      }
    });

    it('should configure Safe CRUD models with operations enabled', () => {
      const safeCrudResources = getSafeCrudResources();
      const expectedModels = [
        'Category',
        'Tag',
        'SiteSettings',
        'DeviceType',
        'DeviceCatalog',
        'GameCatalog',
        'GameAlias',
        'GameStationGame',
      ];
      expect(safeCrudResources.length).toBe(expectedModels.length);
    });

    it('should build complete explicit registry with passwordHash and TOTP secrets hidden', () => {
      const allResources = buildResourceRegistry();
      expect(allResources.length).toBeGreaterThanOrEqual(13);

      const paResource = allResources.find((r) => r.resource.model.name === 'PlatformAdmin');
      expect(paResource).toBeDefined();
      expect(paResource.options.properties.passwordHash.isVisible.show).toBe(false);
      expect(paResource.options.properties.totpSecretEncrypted.isVisible.show).toBe(false);
      expect(paResource.options.properties.totpPendingSecretEncrypted.isVisible.show).toBe(false);
      expect(paResource.options.properties.totpSecretEncrypted.isVisible.edit).toBe(false);
      expect(paResource.options.properties.totpEnabled.isVisible.edit).toBe(false);

      for (const entry of allResources) {
        const listGuard = entry.options?.actions?.list?.isAccessible;
        expect(typeof listGuard).toBe('function');
        expect(listGuard({})).toBe(false);
        expect(listGuard({ currentAdmin: { id: 'pa_1', isSuperuser: true, mfaVerified: false } })).toBe(false);
        expect(listGuard({ currentAdmin: { id: 'pa_1', isSuperuser: false, mfaVerified: true } })).toBe(false);
        expect(listGuard({ currentAdmin: { id: 'pa_1', isSuperuser: true, mfaVerified: true } })).toBe(true);
      }
    });
  });

  describe('4. Dashboard Aggregation and Health Services', () => {
    it('should aggregate platform metrics correctly from Prisma and Health services', async () => {
      const metrics = await DashboardService.getPlatformMetrics();

      expect(metrics.totalGamingCenters).toBe(12);
      expect(metrics.totalUsers).toBe(150);
      expect(metrics.reservations.total).toBe(360);
      expect(metrics.payments.totalVolume).toBe(50000000);
      expect(metrics.health.database.status).toBe('UP');
      expect(metrics.health.redis.status).toBe('UP');
    });

    it('should report database and redis health status', async () => {
      const health = await AdminHealthService.checkHealth();
      expect(health.database.status).toBe('UP');
      expect(health.redis.status).toBe('UP');
      expect(redis.ping).toHaveBeenCalled();
    });
  });

  describe('5. AdminJS Prisma Type Coercion & Update Resilience', () => {
    it('should coerce boolean strings ("true"/"false") to boolean primitives on prepareParams', async () => {
      const { createCustomPrismaResource } = await import('../../../src/platform-admin/bootstrap/register-adapter');
      class MockBaseResource {
        properties() {
          return [
            { path: () => 'isActive', type: () => 'boolean', column: { type: 'Boolean' } },
            { path: () => 'deviceType', type: () => 'string', column: { type: 'GameStationType' } },
            { path: () => 'supportedPlatforms', type: () => 'string', column: { type: 'GameStationType', isList: true } },
          ];
        }
        prepareParams(params: any) {
          return { ...params };
        }
        id() {
          return 'TestResource';
        }
      }

      const CustomClass = createCustomPrismaResource(MockBaseResource);
      const resource = new CustomClass();

      const coerced = resource.prepareParams({
        name: 'PS5 Test Unit',
        deviceType: 'PLAYSTATION 5',
        isActive: 'true',
        supportedPlatforms: 'PLAYSTATION 5',
      });

      expect(coerced.isActive).toBe(true);
      expect(coerced.supportedPlatforms).toEqual(['PLAYSTATION_5']);
    });
  });
});
