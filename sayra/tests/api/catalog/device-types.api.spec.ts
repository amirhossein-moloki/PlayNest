/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import jwt from 'jsonwebtoken';
import { env } from '../../../src/config/env';

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    deviceType: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    deviceCatalog: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../src/config/redis', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  },
  redisCluster: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  },
  DEFAULT_REDIS_CLIENT: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  },
}));

describe('Dynamic Device Types API Test Suite', () => {
  const adminId = 'clpa_test_admin_device_types_1';
  const managerUserId = 'cluser_test_manager_device_types_2';
  const secret = env.JWT_ACCESS_SECRET;

  let adminToken: string;
  let managerToken: string;

  beforeAll(() => {
    adminToken = jwt.sign(
      { actorId: adminId, actorType: 'PLATFORM_ADMIN', role: 'PLATFORM_ADMIN', isSuperuser: true },
      secret,
      { expiresIn: '1h' }
    );

    managerToken = jwt.sign(
      { actorId: managerUserId, actorType: 'USER', role: 'MANAGER', isSuperuser: false },
      secret,
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
    });
  });

  describe('1. Platform Admin Device Types Management', () => {
    it('POST /api/v1/platform-admin/catalog/device-types - creates a new device type', async () => {
      const mockCreated = {
        id: 'cldevicetype_12345678901234',
        name: 'Racing Simulator',
        slug: 'racing-simulator',
        description: 'Motion rig with steering wheel & pedals',
        icon: 'fa-gamepad-steering',
        category: 'PC',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.deviceType.create as jest.Mock).mockResolvedValue(mockCreated);

      const res = await request(app)
        .post('/api/v1/platform-admin/catalog/device-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Racing Simulator',
          slug: 'racing-simulator',
          description: 'Motion rig with steering wheel & pedals',
          icon: 'fa-gamepad-steering',
          category: 'PC',
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Racing Simulator');
      expect(res.body.data.slug).toBe('racing-simulator');
      expect(res.body.data.category).toBe('PC');
      expect(prisma.deviceType.create).toHaveBeenCalled();
    });

    it('POST /api/v1/platform-admin/catalog/device-types - rejects requests without admin credentials', async () => {
      const res = await request(app)
        .post('/api/v1/platform-admin/catalog/device-types')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Unauthorized Type',
        });

      expect(res.status).toBe(403);
      expect(prisma.deviceType.create).not.toHaveBeenCalled();
    });

    it('GET /api/v1/platform-admin/catalog/device-types - lists all device types with pagination', async () => {
      const mockList = [
        {
          id: 'cldevicetype_1',
          name: 'PlayStation 5',
          slug: 'playstation-5',
          category: 'PLAYSTATION',
          isActive: true,
          _count: { deviceCatalogs: 2, stations: 5 },
        },
        {
          id: 'cldevicetype_2',
          name: 'Racing Simulator',
          slug: 'racing-simulator',
          category: 'PC',
          isActive: true,
          _count: { deviceCatalogs: 1, stations: 2 },
        },
      ];

      (prisma.deviceType.findMany as jest.Mock).mockResolvedValue(mockList);
      (prisma.deviceType.count as jest.Mock).mockResolvedValue(2);

      const res = await request(app)
        .get('/api/v1/platform-admin/catalog/device-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data.length).toBe(2);
      expect(res.body.data.data[0].name).toBe('PlayStation 5');
    });

    it('GET /api/v1/platform-admin/catalog/device-types/:id - returns details by ID', async () => {
      const mockItem = {
        id: 'cldevicetype_12345678901234',
        name: 'Racing Simulator',
        slug: 'racing-simulator',
        category: 'PC',
        isActive: true,
        _count: { deviceCatalogs: 1, stations: 2 },
      };

      (prisma.deviceType.findUnique as jest.Mock).mockResolvedValue(mockItem);

      const res = await request(app)
        .get(`/api/v1/platform-admin/catalog/device-types/${mockItem.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(mockItem.id);
      expect(res.body.data.name).toBe('Racing Simulator');
    });

    it('PATCH /api/v1/platform-admin/catalog/device-types/:id - updates an existing device type', async () => {
      const mockUpdated = {
        id: 'cldevicetype_12345678901234',
        name: 'Racing Simulator Ultra',
        slug: 'racing-simulator-ultra',
        category: 'PC',
        isActive: true,
      };

      (prisma.deviceType.findUnique as jest.Mock).mockResolvedValue({ id: mockUpdated.id });
      (prisma.deviceType.update as jest.Mock).mockResolvedValue(mockUpdated);

      const res = await request(app)
        .patch(`/api/v1/platform-admin/catalog/device-types/${mockUpdated.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Racing Simulator Ultra',
          slug: 'racing-simulator-ultra',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Racing Simulator Ultra');
      expect(prisma.deviceType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUpdated.id },
          data: expect.objectContaining({ name: 'Racing Simulator Ultra' }),
        })
      );
    });

    it('DELETE /api/v1/platform-admin/catalog/device-types/:id - deletes device type', async () => {
      const targetId = 'cldevicetype_12345678901234';
      (prisma.deviceType.findUnique as jest.Mock).mockResolvedValue({ id: targetId });
      (prisma.deviceType.delete as jest.Mock).mockResolvedValue({ id: targetId });

      const res = await request(app)
        .delete(`/api/v1/platform-admin/catalog/device-types/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
      expect(prisma.deviceType.delete).toHaveBeenCalledWith({ where: { id: targetId } });
    });
  });

  describe('2. Public & Gaming Center Manager Device Types Endpoints', () => {
    it('GET /api/v1/catalog/device-types - allows public or managers to view active device types', async () => {
      const mockList = [
        {
          id: 'cldevicetype_1',
          name: 'PlayStation 5',
          slug: 'playstation-5',
          category: 'PLAYSTATION',
          isActive: true,
        },
      ];

      (prisma.deviceType.findMany as jest.Mock).mockResolvedValue(mockList);
      (prisma.deviceType.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/catalog/device-types')
        .query({ category: 'PLAYSTATION' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].slug).toBe('playstation-5');
    });

    it('GET /api/v1/catalog/device-types/:id - allows public retrieval by ID', async () => {
      const mockItem = {
        id: 'cldevicetype_1',
        name: 'PlayStation 5',
        slug: 'playstation-5',
        category: 'PLAYSTATION',
        isActive: true,
      };

      (prisma.deviceType.findUnique as jest.Mock).mockResolvedValue(mockItem);

      const res = await request(app).get(`/api/v1/catalog/device-types/${mockItem.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(mockItem.id);
    });
  });
});
