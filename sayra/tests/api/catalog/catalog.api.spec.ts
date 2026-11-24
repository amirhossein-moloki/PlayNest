import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import jwt from 'jsonwebtoken';
import { env } from '../../../src/config/env';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../src/common/stations/upload.station', () => ({
  processAndStoreImage: jest.fn().mockResolvedValue({
    url: '/uploads/mocked-catalog-image.jpg',
    thumbUrl: '/uploads/thumbnails/mocked-catalog-image.jpg',
    fileName: 'mocked-catalog-image.jpg',
  }),
  deleteStoredImage: jest.fn().mockResolvedValue(undefined),
  ensureUploadDirs: jest.fn().mockResolvedValue(undefined),
}));

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
    gamingCenterGame: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
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
        mfaVerified: true,
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
      totpEnabled: true,
      totpSetupCompleted: true,
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
        deviceType: 'PLAYSTATION 5',
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
          deviceType: 'PLAYSTATION 5',
          coverImageUrl: 'https://cdn.example.com/ps5-pro.jpg',
          description: 'Next-gen console with 2TB storage',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('PlayStation 5 Pro');
      expect(res.body.data.deviceType).toBe('PLAYSTATION 5');
      expect(res.body.data.coverImageUrl).toBe('https://cdn.example.com/ps5-pro.jpg');
    });

    it('POST /api/v1/platform-admin/catalog/devices - creates device via direct file upload without coverImageUrl in body', async () => {
      const mockDevice = {
        id: 'cldevice1234567890123499',
        name: 'Xbox Series X',
        deviceType: 'XBOX',
        coverImageUrl: '/uploads/xbox-mock.jpg',
        description: 'Flagship console',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.deviceCatalog.create as jest.Mock).mockResolvedValue(mockDevice);

      const fakeImage = Buffer.from('fake-image-bytes');

      const res = await request(app)
        .post('/api/v1/platform-admin/catalog/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Xbox Series X')
        .field('deviceType', 'XBOX')
        .field('description', 'Flagship console')
        .attach('file', fakeImage, 'xbox.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Xbox Series X');
      expect(res.body.data.coverImageUrl).toBeDefined();
    });

    it('GET /api/v1/catalog/devices - allows gaming center manager to browse devices', async () => {
      const mockDevices = [
        {
          id: 'cldevice1234567890123456',
          name: 'PlayStation 5 Pro',
          deviceType: 'PLAYSTATION 5',
          coverImageUrl: 'https://cdn.example.com/ps5-pro.jpg',
          isActive: true,
        },
      ];
      (prisma.deviceCatalog.findMany as jest.Mock).mockResolvedValue(mockDevices);
      (prisma.deviceCatalog.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/catalog/devices')
        .query({ deviceType: 'PLAYSTATION 5' });

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
        supportedPlatforms: ['PLAYSTATION 5', 'XBOX', 'PC'],
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
          supportedPlatforms: ['PLAYSTATION 5', 'XBOX', 'PC'],
          genre: 'Sports',
          description: 'Football simulation game',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('EA Sports FC 24');
      expect(res.body.data.coverImageUrl).toBe('https://cdn.example.com/fc24.jpg');
    });

    it('POST /api/v1/platform-admin/catalog/games - creates game via direct file upload without coverImageUrl in body', async () => {
      const mockGame = {
        id: 'clgame123456789012349999',
        title: 'Cyberpunk 2077',
        coverImageUrl: '/uploads/cyberpunk-mock.jpg',
        supportedPlatforms: ['PC'],
        genre: 'RPG',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.gameCatalog.create as jest.Mock).mockResolvedValue(mockGame);

      const fakeImage = Buffer.from('fake-game-bytes');

      const res = await request(app)
        .post('/api/v1/platform-admin/catalog/games')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Cyberpunk 2077')
        .field('genre', 'RPG')
        .attach('file', fakeImage, 'cyberpunk.png');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Cyberpunk 2077');
      expect(res.body.data.coverImageUrl).toBeDefined();
    });

    it('GET /api/v1/catalog/games - allows browsing active games', async () => {
      const mockGames = [
        {
          id: 'clgame123456789012345678',
          title: 'EA Sports FC 24',
          coverImageUrl: 'https://cdn.example.com/fc24.jpg',
          supportedPlatforms: ['PLAYSTATION 5', 'XBOX', 'PC'],
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
        deviceType: 'PLAYSTATION 5',
        coverImageUrl: 'https://cdn.example.com/ps5-pro.jpg',
        isActive: true,
      });

      (prisma.gameStation.count as jest.Mock).mockResolvedValue(0);

      const createdBatch = [
        {
          id: 'clstation111111111111111',
          gamingCenterId,
          name: 'PlayStation 5 Pro #1',
          stationType: 'PLAYSTATION_5',
          catalogDeviceId,
          coverImageUrl: 'https://cdn.example.com/ps5-pro.jpg',
          hourlyPrice: 120000,
          isActive: true,
        },
        {
          id: 'clstation222222222222222',
          gamingCenterId,
          name: 'PlayStation 5 Pro #2',
          stationType: 'PLAYSTATION_5',
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

    it('POST /api/v1/gamingCenters/:gamingCenterId/stations/games/from-catalog - adds games from catalog to center (legacy gameCatalogIds defaults to OFFLINE)', async () => {
      const gameCatalogId = 'clgame123456789012345678';
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) =>
        typeof cb === 'function' ? cb(prisma) : cb
      );
      (prisma.gameCatalog.findMany as jest.Mock).mockResolvedValue([
        {
          id: gameCatalogId,
          title: 'EA Sports FC 24',
          supportsOnline: false,
          isActive: true,
        },
      ]);
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue({
        id: gamingCenterId,
        games: ['CS2'],
      });
      (prisma.gamingCenterGame.upsert as jest.Mock).mockResolvedValue({
        id: 'clgcg1',
        gamingCenterId,
        gameCatalogId,
        playMode: 'OFFLINE',
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
      expect(prisma.gamingCenterGame.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ gameCatalogId, playMode: 'OFFLINE' }),
          update: { playMode: 'OFFLINE' },
        })
      );
      expect(res.body.data.games).toEqual([
        expect.objectContaining({
          id: gameCatalogId,
          title: 'EA Sports FC 24',
          supportsOnline: false,
          playMode: 'OFFLINE',
        }),
      ]);
    });
  });

  describe('Game Online/Offline Capability & Per-Center Play Mode', () => {
    it('POST /api/v1/platform-admin/catalog/games - defaults supportsOnline to false when omitted', async () => {
      (prisma.gameCatalog.create as jest.Mock).mockImplementation(async ({ data }: any) => ({
        id: 'clgame123456789012345600',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const res = await request(app)
        .post('/api/v1/platform-admin/catalog/games')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'God of War',
          coverImageUrl: 'https://cdn.example.com/gow.jpg',
          supportedPlatforms: ['PLAYSTATION 5'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.supportsOnline).toBe(false);
      expect(prisma.gameCatalog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'God of War',
            supportsOnline: false,
          }),
        })
      );
    });

    it('POST /api/v1/platform-admin/catalog/games - supports setting supportsOnline=true via JSON and multipart', async () => {
      (prisma.gameCatalog.create as jest.Mock).mockImplementation(async ({ data }: any) => ({
        id: 'clgame123456789012345601',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const jsonRes = await request(app)
        .post('/api/v1/platform-admin/catalog/games')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Counter-Strike 2',
          coverImageUrl: 'https://cdn.example.com/cs2.jpg',
          supportedPlatforms: ['PC'],
          supportsOnline: true,
        });

      expect(jsonRes.status).toBe(201);
      expect(jsonRes.body.data.supportsOnline).toBe(true);

      const multipartRes = await request(app)
        .post('/api/v1/platform-admin/catalog/games')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Valorant')
        .field('supportsOnline', 'true')
        .attach('file', Buffer.from('fake-image'), 'val.png');

      expect(multipartRes.status).toBe(201);
      expect(multipartRes.body.data.supportsOnline).toBe(true);
    });

    it('GET /api/v1/catalog/games?supportsOnline=true - filters catalog games by online capability', async () => {
      (prisma.gameCatalog.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'clgame123456789012345601',
          title: 'Counter-Strike 2',
          coverImageUrl: 'https://cdn.example.com/cs2.jpg',
          supportedPlatforms: ['PC'],
          supportsOnline: true,
          isActive: true,
        },
      ]);
      (prisma.gameCatalog.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app).get('/api/v1/catalog/games').query({ supportsOnline: 'true' });

      expect(res.status).toBe(200);
      expect(prisma.gameCatalog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ supportsOnline: true, isActive: true }),
        })
      );
      expect(res.body.data.data[0].supportsOnline).toBe(true);
    });

    it('PATCH /api/v1/platform-admin/catalog/games/:id - changing supportsOnline from true to false atomically downgrades ONLINE GamingCenterGame records to OFFLINE', async () => {
      const gameId = 'clgame123456789012345601';
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) =>
        typeof cb === 'function' ? cb(prisma) : cb
      );
      (prisma.gameCatalog.findUnique as jest.Mock).mockResolvedValue({
        id: gameId,
        title: 'Counter-Strike 2',
        supportsOnline: true,
        isActive: true,
      });
      (prisma.gameCatalog.update as jest.Mock).mockResolvedValue({
        id: gameId,
        title: 'Counter-Strike 2',
        supportsOnline: false,
        isActive: true,
      });
      (prisma.gamingCenterGame.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      const res = await request(app)
        .patch(`/api/v1/platform-admin/catalog/games/${gameId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ supportsOnline: false });

      expect(res.status).toBe(200);
      expect(res.body.data.supportsOnline).toBe(false);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.gamingCenterGame.updateMany).toHaveBeenCalledWith({
        where: {
          gameCatalogId: gameId,
          playMode: 'ONLINE',
        },
        data: {
          playMode: 'OFFLINE',
        },
      });
    });

    it('POST /api/v1/gamingCenters/:gamingCenterId/stations/games/from-catalog - allows ONLINE for supportsOnline=true and rejects 400 ONLINE_MODE_NOT_SUPPORTED for supportsOnline=false', async () => {
      const onlineGameId = 'clgameonline123456789012';
      const offlineGameId = 'clgameoffline12345678901';

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) =>
        typeof cb === 'function' ? cb(prisma) : cb
      );

      // 1. ONLINE on supportsOnline=true succeeds
      (prisma.gameCatalog.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: onlineGameId,
          title: 'Counter-Strike 2',
          coverImageUrl: 'https://cdn.example.com/cs2.jpg',
          supportedPlatforms: ['PC'],
          supportsOnline: true,
          isActive: true,
        },
      ]);
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValueOnce({
        id: gamingCenterId,
        games: [],
      });
      (prisma.gamingCenterGame.upsert as jest.Mock).mockResolvedValueOnce({
        id: 'clgcg_on1',
        gamingCenterId,
        gameCatalogId: onlineGameId,
        playMode: 'ONLINE',
      });
      (prisma.gamingCenter.update as jest.Mock).mockResolvedValueOnce({
        id: gamingCenterId,
        games: ['Counter-Strike 2'],
      });

      const okRes = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/stations/games/from-catalog`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          games: [{ gameCatalogId: onlineGameId, playMode: 'ONLINE' }],
        });

      expect(okRes.status).toBe(200);
      expect(okRes.body.data.games).toEqual([
        expect.objectContaining({
          id: onlineGameId,
          supportsOnline: true,
          playMode: 'ONLINE',
        }),
      ]);

      // 2. ONLINE on supportsOnline=false fails with 400 ONLINE_MODE_NOT_SUPPORTED
      (prisma.gameCatalog.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: offlineGameId,
          title: 'The Last of Us',
          coverImageUrl: 'https://cdn.example.com/tlou.jpg',
          supportedPlatforms: ['PLAYSTATION_5'],
          supportsOnline: false,
          isActive: true,
        },
      ]);

      const errRes = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/stations/games/from-catalog`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          games: [{ gameCatalogId: offlineGameId, playMode: 'ONLINE' }],
        });

      expect(errRes.status).toBe(400);
      expect(errRes.body.error.code).toBe('ONLINE_MODE_NOT_SUPPORTED');
      expect(prisma.gamingCenter.update).toHaveBeenCalledTimes(1);
    });

    it('PATCH /api/v1/gamingCenters/:gamingCenterId/stations/games/:gameId - switches playMode when supportsOnline=true and rejects ONLINE when supportsOnline=false', async () => {
      const onlineGameId = 'clgameonline123456789012';
      const offlineGameId = 'clgameoffline12345678901';

      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue({
        id: gamingCenterId,
        games: ['Counter-Strike 2', 'The Last of Us'],
      });

      // 1. Switch online-capable game to ONLINE
      (prisma.gamingCenterGame.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'clgcg_1',
        gamingCenterId,
        gameCatalogId: onlineGameId,
        playMode: 'OFFLINE',
        gameCatalog: {
          id: onlineGameId,
          title: 'Counter-Strike 2',
          coverImageUrl: 'https://cdn.example.com/cs2.jpg',
          supportedPlatforms: ['PC'],
          genre: 'FPS',
          description: null,
          supportsOnline: true,
          isActive: true,
        },
      });
      (prisma.gamingCenterGame.upsert as jest.Mock).mockResolvedValueOnce({
        id: 'clgcg_1',
        gamingCenterId,
        gameCatalogId: onlineGameId,
        playMode: 'ONLINE',
      });

      const patchOk = await request(app)
        .patch(`/api/v1/gamingCenters/${gamingCenterId}/stations/games/${onlineGameId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ playMode: 'ONLINE' });

      expect(patchOk.status).toBe(200);
      expect(patchOk.body.data).toEqual(
        expect.objectContaining({
          id: onlineGameId,
          supportsOnline: true,
          playMode: 'ONLINE',
        })
      );

      // 2. Reject switching offline-only game to ONLINE
      (prisma.gamingCenterGame.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'clgcg_2',
        gamingCenterId,
        gameCatalogId: offlineGameId,
        playMode: 'OFFLINE',
        gameCatalog: {
          id: offlineGameId,
          title: 'The Last of Us',
          coverImageUrl: 'https://cdn.example.com/tlou.jpg',
          supportedPlatforms: ['PLAYSTATION_5'],
          genre: 'Action',
          description: null,
          supportsOnline: false,
          isActive: true,
        },
      });

      const patchFail = await request(app)
        .patch(`/api/v1/gamingCenters/${gamingCenterId}/stations/games/${offlineGameId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ playMode: 'ONLINE' });

      expect(patchFail.status).toBe(400);
      expect(patchFail.body.error.code).toBe('ONLINE_MODE_NOT_SUPPORTED');
    });

    it('GET /api/v1/public/gamingCenters/:slug/games - returns supportsOnline and playMode and filters by ?playMode', async () => {
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue({
        id: gamingCenterId,
        slug: 'cyber-arena',
        isActive: true,
        verificationStatus: 'APPROVED',
        games: ['Counter-Strike 2', 'The Last of Us'],
      });
      (prisma.gamingCenterGame.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'clgcg_1',
          gamingCenterId,
          gameCatalogId: 'clgame1',
          playMode: 'ONLINE',
          gameCatalog: {
            id: 'clgame1',
            title: 'Counter-Strike 2',
            coverImageUrl: 'https://cdn.example.com/cs2.jpg',
            supportedPlatforms: ['PC'],
            genre: 'FPS',
            description: null,
            supportsOnline: true,
            isActive: true,
          },
        },
        {
          id: 'clgcg_2',
          gamingCenterId,
          gameCatalogId: 'clgame2',
          playMode: 'OFFLINE',
          gameCatalog: {
            id: 'clgame2',
            title: 'The Last of Us',
            coverImageUrl: 'https://cdn.example.com/tlou.jpg',
            supportedPlatforms: ['PLAYSTATION_5'],
            genre: 'Action',
            description: null,
            supportsOnline: false,
            isActive: true,
          },
        },
      ]);

      const allRes = await request(app).get('/api/v1/public/gamingCenters/cyber-arena/games');
      expect(allRes.status).toBe(200);
      expect(allRes.body.data).toEqual([
        expect.objectContaining({
          id: 'clgame1',
          title: 'Counter-Strike 2',
          supportsOnline: true,
          playMode: 'ONLINE',
        }),
        expect.objectContaining({
          id: 'clgame2',
          title: 'The Last of Us',
          supportsOnline: false,
          playMode: 'OFFLINE',
        }),
      ]);

      const onlineOnlyRes = await request(app)
        .get('/api/v1/public/gamingCenters/cyber-arena/games')
        .query({ playMode: 'ONLINE' });
      expect(onlineOnlyRes.status).toBe(200);
      expect(onlineOnlyRes.body.data).toHaveLength(1);
      expect(onlineOnlyRes.body.data[0].title).toBe('Counter-Strike 2');
    });
  });
});
