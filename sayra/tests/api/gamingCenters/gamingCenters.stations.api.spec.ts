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

describe('Gaming Centers Stations API - Public and Protected Endpoints', () => {
  const mockCenter = {
    id: 'center_07',
    name: 'عمارت بازی کیان',
    slug: 'kiyan-game-palace',
    isActive: true,
  };

  const mockStations = [
    {
      id: 'st_01',
      gamingCenterId: 'center_07',
      name: 'PC-VIP-01',
      stationType: 'PC',
      hourlyPrice: 110000,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: 'st_02',
      gamingCenterId: 'center_07',
      name: 'PS5-VIP-02',
      stationType: 'PLAYSTATION',
      hourlyPrice: 159500,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/gamingCenters/:gamingCenterId/stations', () => {
    it('should return 200 and list of stations without requiring authentication', async () => {
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue(mockCenter);
      (prisma.gameStation.findMany as jest.Mock).mockResolvedValue(mockStations);
      (prisma.gameStation.count as jest.Mock).mockResolvedValue(mockStations.length);

      const res = await request(app).get('/api/v1/gamingCenters/center_07/stations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data.length).toBe(2);
      expect(res.body.data.data[0].id).toBe('st_01');
    });

    it('should return 404 if gaming center does not exist', async () => {
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/v1/gamingCenters/non-existent-center/stations');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/public/gamingCenters/:gamingCenterSlug/stations', () => {
    it('should return 200 and list of stations for public slug lookup', async () => {
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue(mockCenter);
      (prisma.gameStation.findMany as jest.Mock).mockResolvedValue(mockStations);
      (prisma.gameStation.count as jest.Mock).mockResolvedValue(mockStations.length);

      const res = await request(app).get('/api/v1/public/gamingCenters/kiyan-game-palace/stations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data.length).toBe(2);
      expect(res.body.data.data[1].id).toBe('st_02');
      expect(prisma.gamingCenter.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            slug: 'kiyan-game-palace',
            isActive: true,
          },
        })
      );
    });
  });

  describe('POST /api/v1/gamingCenters/:gamingCenterId/stations', () => {
    it('should return 401 Unauthorized when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/v1/gamingCenters/center_07/stations')
        .send({
          name: 'New Station',
          stationType: 'PC',
          hourlyPrice: 120000,
        });

      expect(res.status).toBe(401);
    });
  });
});
