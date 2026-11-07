import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    gameStation: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

describe('Device Categories & Station Catalog Filter API', () => {
  const mockCenter = {
    id: 'center_15',
    name: 'GameNet Arena',
    slug: 'gamenet-arena',
    isActive: true,
  };

  const mockStationsWithCatalog = [
    {
      id: 'st_01',
      gamingCenterId: 'center_15',
      name: 'PC-001',
      stationType: 'PC',
      catalogDeviceId: 'cat_01',
      catalogDevice: {
        id: 'cat_01',
        name: 'Gaming PC High-End',
        deviceType: 'PC',
        coverImageUrl: '/images/pc.jpg',
      },
      hourlyPrice: 120000,
      isActive: true,
    },
    {
      id: 'st_02',
      gamingCenterId: 'center_15',
      name: 'PC-002',
      stationType: 'PC',
      catalogDeviceId: 'cat_01',
      catalogDevice: {
        id: 'cat_01',
        name: 'Gaming PC High-End',
        deviceType: 'PC',
        coverImageUrl: '/images/pc.jpg',
      },
      hourlyPrice: 120000,
      isActive: true,
    },
    {
      id: 'st_03',
      gamingCenterId: 'center_15',
      name: 'PS5-001',
      stationType: 'PLAYSTATION',
      catalogDeviceId: 'cat_02',
      catalogDevice: {
        id: 'cat_02',
        name: 'PlayStation 5 Pro',
        deviceType: 'PLAYSTATION',
        coverImageUrl: '/images/ps5.jpg',
      },
      hourlyPrice: 180000,
      isActive: true,
    },
    {
      id: 'st_04',
      gamingCenterId: 'center_15',
      name: 'Custom-VR-01',
      stationType: 'VR',
      catalogDeviceId: null,
      catalogDevice: null,
      coverImageUrl: '/images/vr.jpg',
      hourlyPrice: 200000,
      isActive: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/gamingCenters/:gamingCenterId/device-categories', () => {
    it('should aggregate device categories with correct counts including fallbacks', async () => {
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue(mockCenter);
      (prisma.gameStation.findMany as jest.Mock).mockResolvedValue(mockStationsWithCatalog);

      const res = await request(app).get('/api/v1/gamingCenters/center_15/device-categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(3);

      const pcCat = res.body.data.find((c: any) => c.catalogId === 'cat_01');
      expect(pcCat).toBeDefined();
      expect(pcCat.name).toBe('Gaming PC High-End');
      expect(pcCat.deviceCount).toBe(2);

      const ps5Cat = res.body.data.find((c: any) => c.catalogId === 'cat_02');
      expect(ps5Cat).toBeDefined();
      expect(ps5Cat.name).toBe('PlayStation 5 Pro');
      expect(ps5Cat.deviceCount).toBe(1);

      const fallbackCat = res.body.data.find((c: any) => c.catalogId === null);
      expect(fallbackCat).toBeDefined();
      expect(fallbackCat.deviceType).toBe('VR');
      expect(fallbackCat.deviceCount).toBe(1);
    });

    it('should return 404 if gaming center not found', async () => {
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/v1/gamingCenters/not-found/device-categories');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/public/gamingCenters/:gamingCenterSlug/device-categories', () => {
    it('should work via public route with slug', async () => {
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue(mockCenter);
      (prisma.gameStation.findMany as jest.Mock).mockResolvedValue(mockStationsWithCatalog);

      const res = await request(app).get('/api/v1/public/gamingCenters/gamenet-arena/device-categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
    });
  });

  describe('GET /api/v1/gamingCenters/:gamingCenterId/stations?catalogDeviceId=...', () => {
    it('should filter stations by catalogDeviceId', async () => {
      const pcCatalogId = 'clh1234567890123456789012';
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue(mockCenter);
      (prisma.gameStation.findMany as jest.Mock).mockResolvedValue([
        mockStationsWithCatalog[0],
        mockStationsWithCatalog[1],
      ]);
      (prisma.gameStation.count as jest.Mock).mockResolvedValue(2);

      const res = await request(app)
        .get(`/api/v1/gamingCenters/center_15/stations?catalogDeviceId=${pcCatalogId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.gameStation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gamingCenterId: 'center_15',
            catalogDeviceId: pcCatalogId,
          }),
        })
      );
    });
  });
});
