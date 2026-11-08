/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';
import * as uploadStation from '../../../src/common/stations/upload.station';
import { auditService } from '../../../src/modules/audit/audit.station';
import { getSafeCrudResources } from '../../../src/platform-admin/resources/safe-crud.resources';
import { buildResourceRegistry } from '../../../src/platform-admin/resources/resource.registry';
import redis from '../../../src/config/redis';
import { ADMIN_CONSTANTS } from '../../../src/platform-admin/config/admin.constants';
import cookieSignature from 'cookie-signature';

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
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $extends: jest.fn().mockReturnThis(),
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../src/common/stations/upload.station', () => ({
  processAndStoreImage: jest.fn().mockResolvedValue({
    url: '/uploads/mocked-image-123.jpg',
    thumbUrl: '/uploads/thumbnails/mocked-image-123.jpg',
    fileName: 'mocked-image-123.jpg',
  }),
  deleteStoredImage: jest.fn().mockResolvedValue(undefined),
  ensureUploadDirs: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/modules/audit/audit.station', () => ({
  auditService: {
    recordLog: jest.fn().mockResolvedValue({ id: 'audit_rec_1' }),
  },
}));

describe('Platform Admin Media & Direct Image Upload Test Suite', () => {
  let superAdminToken: string;
  let regularUserToken: string;

  beforeAll(() => {
    superAdminToken = generateAccessToken({
      sessionId: 'sess_super_1',
      actorId: 'pa_super_1',
      actorType: 'PLATFORM_ADMIN',
    });

    regularUserToken = generateAccessToken({
      sessionId: 'sess_user_1',
      actorId: 'user_regular_1',
      actorType: 'USER',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_super_1',
      fullName: 'Super Administrator',
      phone: '09121112233',
      isActive: true,
      isSuperuser: true,
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user_regular_1',
      fullName: 'Gaming Center Manager',
      phone: '09129998877',
      role: 'MANAGER',
      isActive: true,
      gamingCenterId: 'gc_1',
    });
  });

  describe('1. POST /api/v1/platform-admin/media/upload', () => {
    it('should successfully upload an image file and return public URLs', async () => {
      const imageBuffer = Buffer.from('fake-image-content-bytes');

      const res = await request(app)
        .post('/api/v1/platform-admin/media/upload')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .attach('file', imageBuffer, 'console-cover.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBe('/uploads/mocked-image-123.jpg');
      expect(res.body.data.thumbUrl).toBe('/uploads/thumbnails/mocked-image-123.jpg');
      expect(res.body.data.fileName).toBe('mocked-image-123.jpg');

      expect(uploadStation.processAndStoreImage).toHaveBeenCalled();
      expect(auditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          platformAdminId: 'pa_super_1',
          action: 'PLATFORM_MEDIA_UPLOAD',
          entity: 'Media',
          entityId: 'mocked-image-123.jpg',
        })
      );
    });

    it('should reject requests without a file', async () => {
      const res = await request(app)
        .post('/api/v1/platform-admin/media/upload')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(400);
      expect(uploadStation.processAndStoreImage).not.toHaveBeenCalled();
    });

    it('should successfully upload an image file authenticated via AdminJS session cookie', async () => {
      const adminSessionId = 'sess_cookie_adm_1';
      const redisKey = `${ADMIN_CONSTANTS.SESSION_PREFIX}${adminSessionId}`;

      // In express-session with connect-redis, session objects store cookies and user data
      (redis.get as jest.Mock).mockImplementation((key: string) => {
        if (key === redisKey) {
          return Promise.resolve(
            JSON.stringify({
              cookie: { originalMaxAge: 28800000, expires: new Date(Date.now() + 100000).toISOString() },
              adminUser: {
                id: 'pa_super_1',
                email: 'super@example.com',
                phone: '09121112233',
                fullName: 'Super Administrator',
                isSuperuser: true,
              },
            })
          );
        }
        return Promise.resolve(null);
      });

      const cookieSignature = require('cookie-signature');
      const signedSid = 's:' + cookieSignature.sign(adminSessionId, ADMIN_CONSTANTS.COOKIE_SECRET);

      const imageBuffer = Buffer.from('fake-image-content-bytes');

      const res = await request(app)
        .post('/api/v1/platform-admin/media/upload')
        .set('Cookie', [`${ADMIN_CONSTANTS.SESSION_COOKIE_NAME}=${encodeURIComponent(signedSid)}`])
        .attach('file', imageBuffer, 'console-cover-cookie.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBe('/uploads/mocked-image-123.jpg');

      expect(uploadStation.processAndStoreImage).toHaveBeenCalled();
      expect(auditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          platformAdminId: 'pa_super_1',
          action: 'PLATFORM_MEDIA_UPLOAD',
          entity: 'Media',
        })
      );
    });

    it('should reject unauthenticated requests with 401', async () => {
      const imageBuffer = Buffer.from('fake-image-content-bytes');
      const res = await request(app)
        .post('/api/v1/platform-admin/media/upload')
        .attach('file', imageBuffer, 'test.png');

      expect(res.status).toBe(401);
      expect(uploadStation.processAndStoreImage).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid or nonexistent session cookie with 401', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const imageBuffer = Buffer.from('fake-image-content-bytes');
      const res = await request(app)
        .post('/api/v1/platform-admin/media/upload')
        .set('Cookie', [`${ADMIN_CONSTANTS.SESSION_COOKIE_NAME}=s%3Anonexistent_session.invalid`])
        .attach('file', imageBuffer, 'test.png');

      expect(res.status).toBe(401);
      expect(uploadStation.processAndStoreImage).not.toHaveBeenCalled();
    });

    it('should reject non-platform-admin tokens with 403', async () => {
      const imageBuffer = Buffer.from('fake-image-content-bytes');
      const res = await request(app)
        .post('/api/v1/platform-admin/media/upload')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .attach('file', imageBuffer, 'test.png');

      expect(res.status).toBe(403);
      expect(uploadStation.processAndStoreImage).not.toHaveBeenCalled();
    });
  });

  describe('2. AdminJS Catalog Configuration & Media Lifecycle Hooks', () => {
    it('should configure DeviceCatalog and GameCatalog with CoverImageField components', () => {
      const safeCrud = getSafeCrudResources({ coverImageComponentId: 'CoverImageField' });

      const deviceCatalogRes = safeCrud.find((r) => r.resource.model.name === 'DeviceCatalog');
      const gameCatalogRes = safeCrud.find((r) => r.resource.model.name === 'GameCatalog');

      expect(deviceCatalogRes).toBeDefined();
      expect(deviceCatalogRes.options.properties.coverImageUrl.components.edit).toBe('CoverImageField');
      expect(deviceCatalogRes.options.properties.coverImageUrl.components.show).toBe('CoverImageField');
      expect(deviceCatalogRes.options.properties.coverImageUrl.components.list).toBe('CoverImageField');

      expect(gameCatalogRes).toBeDefined();
      expect(gameCatalogRes.options.properties.coverImageUrl.components.edit).toBe('CoverImageField');
      expect(gameCatalogRes.options.properties.coverImageUrl.components.show).toBe('CoverImageField');
      expect(gameCatalogRes.options.properties.coverImageUrl.components.list).toBe('CoverImageField');
    });

    it('should trigger old image cleanup when cover image is updated in edit hook', async () => {
      const safeCrud = getSafeCrudResources();
      const deviceCatalogRes = safeCrud.find((r) => r.resource.model.name === 'DeviceCatalog');
      const editAfterHook = deviceCatalogRes.options.actions.edit.after;

      expect(editAfterHook).toBeDefined();

      const originalResponse = {
        record: {
          id: 'dev_1',
          params: {
            id: 'dev_1',
            name: 'PS5 Pro',
            coverImageUrl: '/uploads/new-image-456.jpg',
          },
          errors: {},
        },
      };

      const requestMock = { method: 'post' };
      const contextMock = {
        currentAdmin: { id: 'pa_super_1' },
        record: {
          params: {
            id: 'dev_1',
            name: 'PS5 Pro',
            coverImageUrl: '/uploads/old-image-123.jpg',
          },
        },
      };

      await editAfterHook(originalResponse, requestMock, contextMock);

      expect(uploadStation.deleteStoredImage).toHaveBeenCalledWith('/uploads/old-image-123.jpg', undefined);
      expect(auditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          platformAdminId: 'pa_super_1',
          action: 'DEVICECATALOG_UPDATE',
          entity: 'DeviceCatalog',
          entityId: 'dev_1',
        })
      );
    });

    it('should trigger image cleanup on catalog delete hook', async () => {
      const safeCrud = getSafeCrudResources();
      const gameCatalogRes = safeCrud.find((r) => r.resource.model.name === 'GameCatalog');
      const deleteAfterHook = gameCatalogRes.options.actions.delete.after;

      expect(deleteAfterHook).toBeDefined();

      const originalResponse = {};
      const requestMock = { method: 'post' };
      const contextMock = {
        currentAdmin: { id: 'pa_super_1' },
        record: {
          id: 'game_1',
          params: {
            id: 'game_1',
            title: 'FC 25',
            coverImageUrl: '/uploads/fc25-cover.jpg',
          },
        },
      };

      await deleteAfterHook(originalResponse, requestMock, contextMock);

      expect(uploadStation.deleteStoredImage).toHaveBeenCalledWith('/uploads/fc25-cover.jpg', undefined);
      expect(auditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          platformAdminId: 'pa_super_1',
          action: 'GAMECATALOG_DELETE',
          entity: 'GameCatalog',
          entityId: 'game_1',
        })
      );
    });

    it('should pass coverImageComponentId to registry when provided', () => {
      const registry = buildResourceRegistry({ coverImageComponentId: 'CustomCoverField' });
      const deviceRes = registry.find((r) => r.resource.model.name === 'DeviceCatalog');
      expect(deviceRes.options.properties.coverImageUrl.components.edit).toBe('CustomCoverField');
    });
  });
});
