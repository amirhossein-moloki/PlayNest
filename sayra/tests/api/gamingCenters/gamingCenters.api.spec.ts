import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';

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
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
  const now = new Date();
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
    media: [
      {
        id: 'media_01',
        url: 'https://cdn.example.com/cover1.jpg',
        purpose: 'COVER',
        isActive: true,
        sortOrder: 1,
      },
      {
        id: 'media_02',
        url: 'https://cdn.example.com/cover2.jpg',
        purpose: 'COVER',
        isActive: true,
        sortOrder: 2,
      },
    ],
    discounts: [
      {
        id: 'discount_01',
        isActive: true,
        valueType: 'PERCENTAGE',
        value: 20,
        startAt: new Date(now.getTime() - 3600000),
        endAt: new Date(now.getTime() + 3600000),
      },
    ],
    discountCampaigns: [],
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
      expect(res.body.data.hasDiscount).toBe(true);
      expect(res.body.data.has_discount).toBe(true);
      expect(res.body.data.coverImages).toEqual([
        'https://cdn.example.com/cover1.jpg',
        'https://cdn.example.com/cover2.jpg',
      ]);
      expect(res.body.data.coverImageUrl).toBe('https://cdn.example.com/cover1.jpg');
      expect(res.body.data.banner).toBe('https://cdn.example.com/cover1.jpg');
      expect(res.body.data.pricing).toEqual({
        originalPrice: 50000,
        discountPercentage: 20,
        discountAmount: 10000,
        finalPrice: 40000,
        hasDiscount: true,
      });
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

  describe('GET /api/v1/gamingCenters', () => {
    it('should list gaming centers with hasDiscount and coverImages', async () => {
      (prisma.gamingCenter.findMany as jest.Mock).mockResolvedValue([mockCenterData]);
      (prisma.gamingCenter.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app).get('/api/v1/gamingCenters');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data.length).toBe(1);
      const item = res.body.data.data[0];
      expect(item.id).toBe('center_01');
      expect(item.hasDiscount).toBe(true);
      expect(item.has_discount).toBe(true);
      expect(item.coverImages).toEqual([
        'https://cdn.example.com/cover1.jpg',
        'https://cdn.example.com/cover2.jpg',
      ]);
      expect(item.coverImageUrl).toBe('https://cdn.example.com/cover1.jpg');
      expect(item.banner).toBe('https://cdn.example.com/cover1.jpg');
      expect(item.pricing).toEqual({
        originalPrice: 50000,
        discountPercentage: 20,
        discountAmount: 10000,
        finalPrice: 40000,
        hasDiscount: true,
      });
    });

    it('should list gaming centers without discounts having default pricing and null banner when no media', async () => {
      const plainCenter = {
        ...mockCenterData,
        id: 'center_plain',
        media: [],
        discounts: [],
      };
      (prisma.gamingCenter.findMany as jest.Mock).mockResolvedValue([plainCenter]);
      (prisma.gamingCenter.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app).get('/api/v1/gamingCenters');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const item = res.body.data.data[0];
      expect(item.id).toBe('center_plain');
      expect(item.banner).toBeNull();
      expect(item.pricing).toEqual({
        originalPrice: 50000,
        discountPercentage: 0,
        discountAmount: 0,
        finalPrice: 50000,
        hasDiscount: false,
      });
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
      expect(res.body.data.hasDiscount).toBe(true);
      expect(res.body.data.has_discount).toBe(true);
      expect(res.body.data.coverImages).toEqual([
        'https://cdn.example.com/cover1.jpg',
        'https://cdn.example.com/cover2.jpg',
      ]);
      expect(res.body.data.coverImageUrl).toBe('https://cdn.example.com/cover1.jpg');
      expect(res.body.data.banner).toBe('https://cdn.example.com/cover1.jpg');
      expect(res.body.data.pricing).toEqual({
        originalPrice: 50000,
        discountPercentage: 20,
        discountAmount: 10000,
        finalPrice: 40000,
        hasDiscount: true,
      });
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

describe('POST /api/v1/gamingCenters (Creation & Ownership Architecture)', () => {
  const adminActor = {
    id: 'platform_admin_hadi_001',
    fullName: 'Platform Admin Hadi',
    phone: '09120000001',
    email: 'hadi@playnest.test',
    passwordHash: 'argon2id$hashedpassword',
    isActive: true,
    isSuperuser: true,
  };

  const platformAdminToken = generateAccessToken({
    sessionId: 'session_admin_01',
    actorId: adminActor.id,
    actorType: 'PLATFORM_ADMIN',
  });

  const existingUserOwner = {
    id: 'user_owner_01',
    fullName: 'Mohammad Manager',
    phone: '09141001001',
    role: 'MANAGER',
    gamingCenterId: 'old_center_01',
    isActive: true,
  };

  beforeEach(() => {
    (prisma as any).$transaction = jest.fn((cb: any) => cb(prisma));
  });

  it('should successfully create a gaming center when ownerId references a PlatformAdmin', async () => {
    (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue(adminActor);

    const createdCenterMock = {
      id: 'center_new_01',
      name: 'پلی سنتر تبریز',
      slug: 'play-center-tabriz',
      games: ['EA Sports FC 25', 'Call of Duty: Modern Warfare III'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.gamingCenter.create as jest.Mock).mockResolvedValue(createdCenterMock);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'user_created_for_admin',
      fullName: adminActor.fullName,
      phone: adminActor.phone,
      role: 'MANAGER',
      gamingCenterId: createdCenterMock.id,
    });

    const res = await request(app)
      .post('/api/v1/gamingCenters')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'پلی سنتر تبریز',
        slug: 'play-center-tabriz',
        ownerId: 'platform_admin_hadi_001',
        games: ['EA Sports FC 25', 'Call of Duty: Modern Warfare III'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('center_new_01');
    expect(res.body.data.owner).toBeDefined();
    expect(res.body.data.owner.type).toBe('PLATFORM_ADMIN');
    expect(res.body.data.owner.id).toBe('platform_admin_hadi_001');

    // Verify gamingCenter.create was called WITHOUT the unknown ownerId property
    expect(prisma.gamingCenter.create).toHaveBeenCalledWith({
      data: {
        name: 'پلی سنتر تبریز',
        slug: 'play-center-tabriz',
        games: ['EA Sports FC 25', 'Call of Duty: Modern Warfare III'],
      },
    });
  });

  it('should successfully create a gaming center and assign an existing User owner', async () => {
    (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...existingUserOwner,
      gamingCenterId: null, // New/unassigned user
    });
    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue(adminActor);

    const createdCenterMock = {
      id: 'center_new_02',
      name: 'گیم نت صبا',
      slug: 'saba-gaming-center',
      games: ['GTA V'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.gamingCenter.create as jest.Mock).mockResolvedValue(createdCenterMock);
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...existingUserOwner,
      gamingCenterId: createdCenterMock.id,
      role: 'MANAGER',
    });

    const res = await request(app)
      .post('/api/v1/gamingCenters')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'گیم نت صبا',
        slug: 'saba-gaming-center',
        ownerId: existingUserOwner.id,
        games: ['GTA V'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('center_new_02');
    expect(res.body.data.owner.type).toBe('USER');
    expect(res.body.data.owner.id).toBe(existingUserOwner.id);
    expect(res.body.data.owner.role).toBe('MANAGER');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: existingUserOwner.id },
      data: {
        gamingCenterId: createdCenterMock.id,
        role: 'MANAGER',
        isActive: true,
      },
    });
  });

  it('should reject creation with 404 if ownerId does not exist in User or PlatformAdmin', async () => {
    (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue(adminActor); // auth check passes

    // In station ownership check:
    (prisma.platformAdmin.findUnique as jest.Mock).mockImplementation((args: any) => {
      if (args.where.id === adminActor.id) return Promise.resolve(adminActor);
      return Promise.resolve(null);
    });

    const res = await request(app)
      .post('/api/v1/gamingCenters')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'گیم نت نامعتبر',
        slug: 'invalid-center',
        ownerId: 'non_existent_owner_999',
        games: [],
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 409 conflict when duplicate slug is used', async () => {
    (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue({
      id: 'center_existing',
      slug: 'duplicate-center',
    });
    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue(adminActor);

    const res = await request(app)
      .post('/api/v1/gamingCenters')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'گیم نت تکراری',
        slug: 'duplicate-center',
        ownerId: 'platform_admin_hadi_001',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should reject unauthorized reassignment if user belongs to another center and actor is not superuser', async () => {
    (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue(null);

    const tenantUserToken = generateAccessToken({
      sessionId: 'sess_user_02',
      actorId: 'other_user_id',
      actorType: 'USER',
    });

    (prisma.user.findUnique as jest.Mock).mockImplementation((args: any) => {
      if (args.where.id === 'other_user_id') {
        return Promise.resolve({
          id: 'other_user_id',
          role: 'MANAGER',
          gamingCenterId: 'center_1',
          isActive: true,
        });
      }
      if (args.where.id === existingUserOwner.id) {
        return Promise.resolve({
          ...existingUserOwner,
          gamingCenterId: 'center_2', // Already belongs to center_2
        });
      }
      return Promise.resolve(null);
    });

    const res = await request(app)
      .post('/api/v1/gamingCenters')
      .set('Authorization', `Bearer ${tenantUserToken}`)
      .send({
        name: 'گیم نت تلاش جابجایی غیرمجاز',
        slug: 'unauthorized-move',
        ownerId: existingUserOwner.id,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
