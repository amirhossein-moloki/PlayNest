import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import jwt from 'jsonwebtoken';
import { env } from '../../../src/config/env';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    deviceCatalog: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    gameCatalog: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    gameStation: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('Catalog API & Station From Catalog Flow', () => {
  const adminId = 'cladmin123456789012345678';
  const managerUserId = 'cluser123456789012345678';
  const gamingCenterId = 'clcenter1234567890123456';

  let adminToken: string;
  let managerToken: string;

  beforeAll(() => {
    const SECRET = env.JWT_ACCESS_SECRET || 'test-access-secret';
    adminToken = jwt.sign(
      {
        sessionId: 'session_admin',
        actorId: adminId,
        actorType: 'PLATFORM_ADMIN',
      },
      SECRET,
      { expiresIn: '1h' }
    );

    managerToken = jwt.sign(
      {
        sessionId: 'session_manager',
        actorId: managerUserId,
        actorType: 'USER',
      },
      SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: adminId,
      isActive: true,
      isSuperuser: true,
      role: 'SUPERUSER',
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: managerUserId,
      isActive: true,
      role: 'MANAGER',
      gamingCenterId,
    });
  });

  describe('Platform Admin Device Catalog', () => {
    it('POST /api/v1/platform-admin/catalog/devices - creates a new device in catalog', async () => {
      const mockDevice = {
        id: 'cldevice1234567890123456',
        name: 'PlayStation 5 Pro',
        deviceType: 'PLAYSTATION',
        coverImageUrl: 'https://cdn.example.com/ps5-pro.jpg',
        description: 'Next-gen console with 2TB storage',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.deviceCatalog.create as jest.Mock).mockResolvedValue(mockDevice);

      const res = await request(app)
        .post('/api/v1/platform-admin/catalog/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'PlayStation 5 Pro',
          deviceType: 'PLAYSTATION',
          coverImageUrl: 'https://cdn.example.com/ps5-pro.jpg',
          description: 'Next-gen console with 2TB storage',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('PlayStation 5 Pro');
      expect(res.body.data.deviceType).toBe('PLAYSTATION');
      expect(res.body.data.coverImageUrl).toBe('https://cdn.example.com/ps5-pro.jpg');
    });

    it('GET /api/v1/catalog/devices - allows gaming center manager to browse devices', async () => {
      const mockDevices = [
        {
          id: 'cldevice1234567890123456',
          name: 'PlayStation 5 Pro',
          deviceType: 'PLAYSTATION',
          coverImageUrl: 'https://cdn.example.com/ps5-pro.jpg',
          isActive: true,
        },
      ];
      (prisma.deviceCatalog.findMany as jest.Mock).mockResolvedValue(mockDevices);
      (prisma.deviceCatalog.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/catalog/devices')
        .query({ deviceType: 'PLAYSTATION' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].name).toBe('PlayStation 5 Pro');
    });
  });

  describe('Platform Admin Game Catalog', () => {
    it('POST /api/v1/platform-admin/catalog/games - creates a new game in catalog', async () => {
      const mockGame = {
        id: 'clgame123456789012345678',
        title: 'EA Sports FC 24',
        coverImageUrl: 'https://cdn.example.com/fc24.jpg',
        supportedPlatforms: ['PLAYSTATION', 'XBOX', 'PC'],
        genre: 'Sports',
        description: 'Football simulation game',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.gameCatalog.create as jest.Mock).mockResolvedValue(mockGame);

      const res = await request(app)
        .post('/api/v1/platform-admin/catalog/games')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'EA Sports FC 24',
          coverImageUrl: 'https://cdn.example.com/fc24.jpg',
          supportedPlatforms: ['PLAYSTATION', 'XBOX', 'PC'],
          genre: 'Sports',
          description: 'Football simulation game',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('EA Sports FC 24');
      expect(res.body.data.coverImageUrl).toBe('https://cdn.example.com/fc24.jpg');
    });

    it('GET /api/v1/catalog/games - allows browsing active games', async () => {
      const mockGames = [
        {
          id: 'clgame123456789012345678',
          title: 'EA Sports FC 24',
          coverImageUrl: 'https://cdn.example.com/fc24.jpg',
          supportedPlatforms: ['PLAYSTATION', 'XBOX', 'PC'],
          isActive: true,
        },
      ];
      (prisma.gameCatalog.findMany as jest.Mock).mockResolvedValue(mockGames);
      (prisma.gameCatalog.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app).get('/api/v1/catalog/games');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].title).toBe('EA Sports FC 24');
    });
  });

  describe('Gaming Center Manager Station Creation from Catalog', () => {
    it('POST /api/v1/gamingCenters/:gamingCenterId/stations/from-catalog - creates stations in bulk with quantity & hourlyPrice', async () => {
      const catalogDeviceId = 'cldevice1234567890123456';
      (prisma.deviceCatalog.findUnique as jest.Mock).mockResolvedValue({
        id: catalogDeviceId,
        name: 'PlayStation 5 Pro',
        deviceType: 'PLAYSTATION',
        coverImageUrl: 'https://cdn.example.com/ps5-pro.jpg',
        isActive: true,
      });

      (prisma.gameStation.count as jest.Mock).mockResolvedValue(0);

      const createdBatch = [
        {
          id: 'clstation111111111111111',
          gamingCenterId,
          name: 'PlayStation 5 Pro #1',
          stationType: 'PLAYSTATION',
          catalogDeviceId,
          coverImageUrl: 'https://cdn.example.com/ps5-pro.jpg',
          hourlyPrice: 120000,
          isActive: true,
        },
        {
          id: 'clstation222222222222222',
          gamingCenterId,
          name: 'PlayStation 5 Pro #2',
          stationType: 'PLAYSTATION',
          catalogDeviceId,
          coverImageUrl: 'https://cdn.example.com/ps5-pro.jpg',
          hourlyPrice: 120000,
          isActive: true,
        },
      ];

      (prisma.$transaction as jest.Mock).mockResolvedValue(createdBatch);
      (prisma.gamingCenter.update as jest.Mock).mockResolvedValue({
        id: gamingCenterId,
        consoleCount: 2,
      });

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/stations/from-catalog`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          catalogDeviceId,
          quantity: 2,
          hourlyPrice: 120000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].name).toBe('PlayStation 5 Pro #1');
      expect(res.body.data[0].hourlyPrice).toBe(120000);
      expect(res.body.data[0].coverImageUrl).toBe('https://cdn.example.com/ps5-pro.jpg');
    });

    it('POST /api/v1/gamingCenters/:gamingCenterId/stations/games/from-catalog - adds games from catalog to center', async () => {
      const gameCatalogId = 'clgame123456789012345678';
      (prisma.gameCatalog.findMany as jest.Mock).mockResolvedValue([
        {
          id: gameCatalogId,
          title: 'EA Sports FC 24',
        },
      ]);
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue({
        id: gamingCenterId,
        games: ['CS2'],
      });
      (prisma.gamingCenter.update as jest.Mock).mockResolvedValue({
        id: gamingCenterId,
        games: ['CS2', 'EA Sports FC 24'],
      });

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/stations/games/from-catalog`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          gameCatalogIds: [gameCatalogId],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.addedGames).toEqual(['EA Sports FC 24']);
      expect(res.body.data.allGames).toEqual(['CS2', 'EA Sports FC 24']);
    });
  });
});
