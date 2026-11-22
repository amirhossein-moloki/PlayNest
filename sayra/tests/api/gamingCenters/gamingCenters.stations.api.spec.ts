import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import jwt from 'jsonwebtoken';
import { env } from '../../../src/config/env';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    gameStation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    stationExtraController: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    deviceType: {
      findFirst: jest.fn(),
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
    $transaction: jest.fn((callback: any) =>
      typeof callback === 'function' ? callback(prisma) : Promise.all(callback)
    ),
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
      stationType: 'PLAYSTATION_5',
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

    it('should create station with extraControllers and include correct gamingCenterId', async () => {
      const managerUserId = 'cluser123456789012345678';
      const centerId = 'cmwlxvn5r0014137pppik07te';
      const stationId = 'cmwlxy27x001g137pfqfrb3uo';
      const managerToken = jwt.sign(
        { sessionId: 'sess_1', actorId: managerUserId, actorType: 'USER' },
        env.JWT_ACCESS_SECRET || 'test-access-secret',
        { expiresIn: '1h' }
      );

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: managerUserId,
        isActive: true,
        role: 'MANAGER',
        gamingCenterId: centerId,
      });
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue({
        id: centerId,
        slug: 'center-slug',
        isActive: true,
      });

      const createdStation = {
        id: stationId,
        gamingCenterId: centerId,
        name: 'PS5-01',
        stationType: 'PLAYSTATION_5',
        hourlyPrice: 100000,
        isActive: true,
        deviceTypeRef: { extraControllerEnabled: true },
        catalogDevice: null,
      };

      (prisma.gameStation.create as jest.Mock).mockResolvedValue(createdStation);
      (prisma.gameStation.findFirst as jest.Mock).mockResolvedValue(createdStation);
      (prisma.gameStation.findUnique as jest.Mock).mockResolvedValue(createdStation);
      (prisma.stationExtraController.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.stationExtraController.create as jest.Mock).mockImplementation(async ({ data }: any) => ({
        id: 'ec_123',
        ...data,
      }));

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${centerId}/stations`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'PS5-01',
          stationType: 'PLAYSTATION 5',
          hourlyPrice: 100000,
          extraControllers: [
            {
              controllerType: 'دسته PS5',
              quantity: 2,
              hourlyPrice: 35000,
              isActive: true,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(prisma.stationExtraController.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stationId,
            gamingCenterId: centerId,
            controllerType: 'دسته PS5',
            quantity: 2,
            hourlyPrice: 35000,
          }),
        })
      );
    });
  });

  describe('Station Extra Controllers Endpoints (PUT & POST)', () => {
    const managerUserId = 'cluser123456789012345678';
    const centerId = 'cmwlxvn5r0014137pppik07te';
    const stationId = 'cmwlxy27x001g137pfqfrb3uo';
    let managerToken: string;

    beforeEach(() => {
      managerToken = jwt.sign(
        { sessionId: 'sess_1', actorId: managerUserId, actorType: 'USER' },
        env.JWT_ACCESS_SECRET || 'test-access-secret',
        { expiresIn: '1h' }
      );

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: managerUserId,
        isActive: true,
        role: 'MANAGER',
        gamingCenterId: centerId,
      });
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue({
        id: centerId,
        slug: 'center-slug',
        isActive: true,
      });

      const stationData = {
        id: stationId,
        gamingCenterId: centerId,
        name: 'PS5-VIP',
        stationType: 'PLAYSTATION_5',
        hourlyPrice: 150000,
        isActive: true,
        deviceTypeRef: { extraControllerEnabled: true },
        catalogDevice: null,
      };

      (prisma.gameStation.findFirst as jest.Mock).mockResolvedValue(stationData);
      (prisma.gameStation.findUnique as jest.Mock).mockResolvedValue(stationData);
      (prisma.stationExtraController.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.stationExtraController.create as jest.Mock).mockImplementation(async ({ data }: any) => ({
        id: 'ec_row_1',
        ...data,
      }));
    });

    it('PUT /api/v1/gamingCenters/:gamingCenterId/stations/:stationId/extra-controllers should replace extra controllers with correct gamingCenterId and not undefined', async () => {
      const res = await request(app)
        .put(`/api/v1/gamingCenters/${centerId}/stations/${stationId}/extra-controllers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          extraControllers: [
            {
              controllerType: 'دسته PS5',
              quantity: 3,
              hourlyPrice: 35000,
              isActive: true,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(prisma.stationExtraController.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stationId,
            gamingCenterId: centerId,
            controllerType: 'دسته PS5',
            quantity: 3,
            hourlyPrice: 35000,
            isActive: true,
          }),
        })
      );

      // Verify gamingCenterId is NOT undefined
      const createCall = (prisma.stationExtraController.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.gamingCenterId).toBe(centerId);
      expect(createCall.data.gamingCenterId).not.toBeUndefined();
    });

    it('POST /api/v1/gamingCenters/:gamingCenterId/stations/:stationId/extra-controllers should add extra controller with correct gamingCenterId', async () => {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${centerId}/stations/${stationId}/extra-controllers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          controllerType: 'دسته DualSense Edge',
          quantity: 2,
          hourlyPrice: 50000,
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(prisma.stationExtraController.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stationId,
            gamingCenterId: centerId,
            controllerType: 'دسته DualSense Edge',
            quantity: 2,
            hourlyPrice: 50000,
          }),
        })
      );

      const createCall = (prisma.stationExtraController.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.gamingCenterId).toBe(centerId);
      expect(createCall.data.gamingCenterId).not.toBeUndefined();
    });
  });
});
