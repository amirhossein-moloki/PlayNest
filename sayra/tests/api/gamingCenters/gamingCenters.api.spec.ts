import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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

describe('Gaming Centers API - Retrieval by ID and Slug', () => {
  const mockCenterData = {
    id: 'center_01',
    name: 'Rematch Game Net',
    slug: 'rematch-game-net',
    isActive: true,
    description: 'Best game center in town',
    pcCount: 20,
    consoleCount: 10,
    hourlyRate: 50000,
    openingTime: '10:00',
    closingTime: '23:00',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    addresses: [
      {
        id: 'addr_01',
        city: 'Tehran',
        province: 'Tehran',
        addressLine: 'Valiasr St',
        isPrimary: true,
      },
    ],
    stations: [
      { id: 'st_1', stationType: 'PC', name: 'PC-VIP-1' },
      { id: 'st_2', stationType: 'PLAYSTATION', name: 'PS5-Pro' },
    ],
    ratings: [
      { rating: 5, comment: 'Awesome', status: 'PUBLISHED' },
    ],
    settings: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/gamingCenters/:id', () => {
    it('should return gaming center details when queried with an ID', async () => {
      (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue(mockCenterData);

      const res = await request(app).get('/api/v1/gamingCenters/center_01');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('center_01');
      expect(res.body.data.slug).toBe('rematch-game-net');
      expect(res.body.data.pc).toBe(true);
      expect(res.body.data.ps5).toBe(true);
      expect(prisma.gamingCenter.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ id: 'center_01' }, { slug: 'center_01' }],
            isActive: true,
          },
        })
      );
    });

    it('should return gaming center details when queried with a slug', async () => {
      (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue(mockCenterData);

      const res = await request(app).get('/api/v1/gamingCenters/rematch-game-net');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('center_01');
      expect(res.body.data.slug).toBe('rematch-game-net');
      expect(prisma.gamingCenter.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ id: 'rematch-game-net' }, { slug: 'rematch-game-net' }],
            isActive: true,
          },
        })
      );
    });

    it('should return 404 when gaming center is not found', async () => {
      (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/v1/gamingCenters/non-existent-center');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/public/gamingCenters/:gamingCenterSlug', () => {
    it('should return gaming center JSON details when queried via public route', async () => {
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue({
        id: 'center_01',
        slug: 'rematch-game-net',
        isActive: true,
      });
      (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue(mockCenterData);

      const res = await request(app)
        .get('/api/v1/public/gamingCenters/rematch-game-net')
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('center_01');
      expect(res.body.data.slug).toBe('rematch-game-net');
    });

    it('should return 404 for non-existent public gaming center slug', async () => {
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/public/gamingCenters/unknown-center')
        .set('Accept', 'application/json');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
