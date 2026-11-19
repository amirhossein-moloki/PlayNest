/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';

jest.mock('../../../src/config/redis', () => ({
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  del: jest.fn().mockImplementation(() => Promise.resolve(1)),
}));

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    platformAdmin: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn(),
    },
    media: {
      findUnique: jest.fn(),
    },
    advertisementRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    ['$extends']: jest.fn().mockReturnThis(),
    ['$transaction']: jest.fn(),
  },
}));

describe('Platform Admin Advertisement Management API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).$transaction.mockImplementation(async (callback: any) => {
      return callback(prisma);
    });
  });

  const platformAdminToken = generateAccessToken({
    sessionId: 'sess_admin_ads',
    actorId: 'pa_ad_1',
    actorType: 'PLATFORM_ADMIN',
  });

  const tenantManagerToken = generateAccessToken({
    sessionId: 'sess_manager_ads',
    actorId: 'usr_mgr_ad',
    actorType: 'USER',
  });

  const sampleAdRequest = {
    id: 'ad_req_100',
    title: 'Winter Tournament Promo',
    description: 'Promote our upcoming winter esports tournament',
    bannerUrl: 'https://storage.playnest.ir/gamingCenters/gc_1/media/original/banner1.jpg',
    mediaType: 'IMAGE',
    destinationUrl: 'https://cyberarena.ir/tournaments/winter',
    durationDays: 30,
    startDate: new Date('2026-12-01T00:00:00Z'),
    endDate: new Date('2026-12-31T00:00:00Z'),
    status: 'PENDING',
    decisionReason: null,
    reviewedById: null,
    reviewedAt: null,
    adminNote: null,
    createdAt: new Date('2026-11-10T10:00:00Z'),
    updatedAt: new Date('2026-11-10T10:00:00Z'),
    gamingCenter: {
      id: 'gc_1',
      name: 'Cyber Arena',
      slug: 'cyber-arena',
      addresses: [
        {
          city: 'Tehran',
          addressLine: 'Valiasr St, No 100',
          isPrimary: true,
        },
      ],
    },
    owner: {
      id: 'usr_owner_1',
      fullName: 'Mohammad Rezaei',
      phone: '09123456789',
      email: 'm.rezaei@cyberarena.ir',
    },
    reviewedBy: null,
    media: {
      id: 'med_1',
      url: 'https://storage.playnest.ir/gamingCenters/gc_1/media/original/banner1.jpg',
      thumbUrl: 'https://storage.playnest.ir/gamingCenters/gc_1/media/thumb/banner1.jpg',
      type: 'IMAGE',
      mime: 'image/jpeg',
      sizeBytes: 1048576,
    },
  };

  const setupAdminAuth = () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_ad_1',
      fullName: 'Chief Superuser',
      isActive: true,
      isSuperuser: true,
    });
  };

  describe('GET /platform-admin/ad-requests', () => {
    it('1. Retrieves list of advertisement requests for PLATFORM_ADMIN', async () => {
      setupAdminAuth();
      ((prisma as any).advertisementRequest.findMany as jest.Mock).mockResolvedValue([sampleAdRequest]);
      ((prisma as any).advertisementRequest.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/platform-admin/ad-requests')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe('ad_req_100');
      expect(res.body.data[0].title).toBe('Winter Tournament Promo');
      expect(res.body.data[0].gamingCenter.name).toBe('Cyber Arena');
      expect(res.body.data[0].owner.firstName).toBe('Mohammad');
      expect(res.body.data[0].owner.lastName).toBe('Rezaei');
      expect(res.body.data[0].owner.phone).toBe('09123456789');
      expect(res.body.meta.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 1,
        totalItems: 1,
        totalPages: 1,
      });
    });

    it('2. Supports pagination parameters (page, limit)', async () => {
      setupAdminAuth();
      ((prisma as any).advertisementRequest.findMany as jest.Mock).mockResolvedValue([]);
      ((prisma as any).advertisementRequest.count as jest.Mock).mockResolvedValue(45);

      const res = await request(app)
        .get('/api/v1/platform-admin/ad-requests?page=2&limit=15')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.pagination).toEqual({
        page: 2,
        pageSize: 15,
        total: 45,
        totalItems: 45,
        totalPages: 3,
      });

      expect((prisma as any).advertisementRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 15,
          take: 15,
        })
      );
    });

    it('3. Filters by search query on ad title and center name', async () => {
      setupAdminAuth();
      ((prisma as any).advertisementRequest.findMany as jest.Mock).mockResolvedValue([sampleAdRequest]);
      ((prisma as any).advertisementRequest.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/platform-admin/ad-requests?search=Winter')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect((prisma as any).advertisementRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {
                OR: [
                  { title: { contains: 'Winter', mode: 'insensitive' } },
                  { gamingCenter: { name: { contains: 'Winter', mode: 'insensitive' } } },
                ],
              },
            ]),
          }),
        })
      );
    });

    it('4. Filters by city', async () => {
      setupAdminAuth();
      ((prisma as any).advertisementRequest.findMany as jest.Mock).mockResolvedValue([]);
      ((prisma as any).advertisementRequest.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/v1/platform-admin/ad-requests?city=Tehran')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect((prisma as any).advertisementRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gamingCenter: {
              addresses: {
                some: {
                  city: { contains: 'Tehran', mode: 'insensitive' },
                },
              },
            },
          }),
        })
      );
    });

    it('5. Filters by gamingCenterId and ownerId', async () => {
      setupAdminAuth();
      ((prisma as any).advertisementRequest.findMany as jest.Mock).mockResolvedValue([]);
      ((prisma as any).advertisementRequest.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/v1/platform-admin/ad-requests?gamingCenterId=gc_1&ownerId=usr_owner_1')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect((prisma as any).advertisementRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gamingCenterId: 'gc_1',
            ownerId: 'usr_owner_1',
          }),
        })
      );
    });

    it('6. Filters by status (PENDING, APPROVED, REJECTED, EXPIRED)', async () => {
      setupAdminAuth();
      ((prisma as any).advertisementRequest.findMany as jest.Mock).mockResolvedValue([]);
      ((prisma as any).advertisementRequest.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/v1/platform-admin/ad-requests?status=PENDING')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect((prisma as any).advertisementRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      );
    });

    it('7. Combines multiple filters simultaneously', async () => {
      setupAdminAuth();
      ((prisma as any).advertisementRequest.findMany as jest.Mock).mockResolvedValue([]);
      ((prisma as any).advertisementRequest.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get('/api/v1/platform-admin/ad-requests?city=Tehran&status=APPROVED&gamingCenterId=gc_1&search=Esports')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect((prisma as any).advertisementRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gamingCenterId: 'gc_1',
            status: 'APPROVED',
          }),
        })
      );
    });

    it('8. Prevents unauthorized users from accessing the endpoint (401 unauthenticated, 403 non-admin)', async () => {
      // 401 unauthenticated
      const unauthRes = await request(app).get('/api/v1/platform-admin/ad-requests');
      expect(unauthRes.status).toBe(401);

      // 403 non-admin (tenant manager)
      ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr_mgr_ad',
        fullName: 'Tenant Manager',
        role: 'MANAGER',
      });

      const forbiddenRes = await request(app)
        .get('/api/v1/platform-admin/ad-requests')
        .set('Authorization', `Bearer ${tenantManagerToken}`);

      expect(forbiddenRes.status).toBe(403);
    });
  });

  describe('GET /platform-admin/ad-requests/:id', () => {
    it('9. Retrieves full details of a specific advertisement request', async () => {
      setupAdminAuth();
      ((prisma as any).advertisementRequest.findUnique as jest.Mock).mockResolvedValue(sampleAdRequest);

      const res = await request(app)
        .get('/api/v1/platform-admin/ad-requests/ad_req_100')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('ad_req_100');
      expect(res.body.data.title).toBe('Winter Tournament Promo');
      expect(res.body.data.bannerUrl).toBe(sampleAdRequest.bannerUrl);
      expect(res.body.data.gamingCenter.city).toBe('Tehran');
      expect(res.body.data.gamingCenter.address).toBe('Valiasr St, No 100');
      expect(res.body.data.owner.email).toBe('m.rezaei@cyberarena.ir');
    });

    it('10. Returns 404 if advertisement request is not found', async () => {
      setupAdminAuth();
      ((prisma as any).advertisementRequest.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/platform-admin/ad-requests/non_existent_id')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /platform-admin/ad-requests/:id/status', () => {
    it('11. Approves a PENDING advertisement request, computes endDate, records reviewer and audit log', async () => {
      setupAdminAuth();
      ((prisma as any).advertisementRequest.findUnique as jest.Mock).mockResolvedValue(sampleAdRequest);

      const updatedAdRecord = {
        ...sampleAdRequest,
        status: 'APPROVED',
        reviewedById: 'pa_ad_1',
        reviewedAt: new Date(),
        decisionReason: 'Ad content verified and approved.',
        adminNote: 'Verified high quality banner.',
        startDate: new Date('2027-11-15T00:00:00Z'),
        durationDays: 30,
        endDate: new Date('2027-12-15T00:00:00Z'),
        reviewedBy: {
          id: 'pa_ad_1',
          fullName: 'Chief Superuser',
          email: 'admin@playnest.ir',
        },
      };

      ((prisma as any).advertisementRequest.update as jest.Mock).mockResolvedValue(updatedAdRecord);

      const res = await request(app)
        .patch('/api/v1/platform-admin/ad-requests/ad_req_100/status')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          status: 'APPROVED',
          decisionReason: 'Ad content verified and approved.',
          adminNote: 'Verified high quality banner.',
          startDate: '2027-11-15T00:00:00Z',
          durationDays: 30,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.reviewedBy.id).toBe('pa_ad_1');
      expect((prisma as any).auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ADVERTISEMENT_REQUEST_APPROVED',
            entity: 'AdvertisementRequest',
            entityId: 'ad_req_100',
            platformAdminId: 'pa_ad_1',
          }),
        })
      );
    });

    it('12. Rejects a PENDING advertisement request when decisionReason is provided', async () => {
      setupAdminAuth();
      ((prisma as any).advertisementRequest.findUnique as jest.Mock).mockResolvedValue(sampleAdRequest);

      const rejectedAdRecord = {
        ...sampleAdRequest,
        status: 'REJECTED',
        reviewedById: 'pa_ad_1',
        reviewedAt: new Date(),
        decisionReason: 'Banner image resolution is too low.',
        adminNote: 'Advised owner to upload 1080p banner.',
        reviewedBy: {
          id: 'pa_ad_1',
          fullName: 'Chief Superuser',
          email: 'admin@playnest.ir',
        },
      };

      ((prisma as any).advertisementRequest.update as jest.Mock).mockResolvedValue(rejectedAdRecord);

      const res = await request(app)
        .patch('/api/v1/platform-admin/ad-requests/ad_req_100/status')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          status: 'REJECTED',
          decisionReason: 'Banner image resolution is too low.',
          adminNote: 'Advised owner to upload 1080p banner.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.decisionReason).toBe('Banner image resolution is too low.');
      expect((prisma as any).auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ADVERTISEMENT_REQUEST_REJECTED',
            entity: 'AdvertisementRequest',
            entityId: 'ad_req_100',
          }),
        })
      );
    });

    it('13. Enforces decisionReason when rejecting an advertisement request (400 validation error)', async () => {
      setupAdminAuth();

      const res = await request(app)
        .patch('/api/v1/platform-admin/ad-requests/ad_req_100/status')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          status: 'REJECTED',
          // missing decisionReason
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect((prisma as any).advertisementRequest.update).not.toHaveBeenCalled();
    });

    it('14. Prevents re-evaluation of already decided (APPROVED or REJECTED) requests with 409 CONFLICT', async () => {
      setupAdminAuth();
      const alreadyApproved = {
        ...sampleAdRequest,
        status: 'APPROVED',
        reviewedById: 'pa_ad_1',
        reviewedAt: new Date('2026-11-12T00:00:00Z'),
      };
      ((prisma as any).advertisementRequest.findUnique as jest.Mock).mockResolvedValue(alreadyApproved);

      const res = await request(app)
        .patch('/api/v1/platform-admin/ad-requests/ad_req_100/status')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          status: 'REJECTED',
          decisionReason: 'Attempting to reject an already approved ad.',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect((prisma as any).advertisementRequest.update).not.toHaveBeenCalled();
    });

    it('15. Automatically computes status as EXPIRED if approved ad endDate has passed', async () => {
      setupAdminAuth();
      const pastEndDateAd = {
        ...sampleAdRequest,
        status: 'APPROVED',
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2025-02-01T00:00:00Z'), // Past
      };
      ((prisma as any).advertisementRequest.findUnique as jest.Mock).mockResolvedValue(pastEndDateAd);

      const res = await request(app)
        .get('/api/v1/platform-admin/ad-requests/ad_req_100')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('EXPIRED');
    });
  });

  describe('POST /api/v1/platform-admin/ad-requests (Direct Platform Admin Creation)', () => {
    it('16. Rejects unauthorized / non-PlatformAdmin users (401 & 403)', async () => {
      const unauthRes = await request(app)
        .post('/api/v1/platform-admin/ad-requests')
        .send({
          title: 'Global Promo',
          bannerUrl: 'https://cdn.playnest.ir/promo.png',
        });
      expect(unauthRes.status).toBe(401);

      ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
        id: 'usr_mgr_ad',
        role: 'MANAGER',
        isActive: true,
        gamingCenterId: 'gc_1',
      });
      const mgrRes = await request(app)
        .post('/api/v1/platform-admin/ad-requests')
        .set('Authorization', `Bearer ${tenantManagerToken}`)
        .send({
          title: 'Global Promo',
          bannerUrl: 'https://cdn.playnest.ir/promo.png',
        });
      expect(mgrRes.status).toBe(403);
    });

    it('17. Creates an advertisement linked to a Gaming Center directly with APPROVED/ACTIVE status', async () => {
      setupAdminAuth();
      ((prisma as any).gamingCenter.findUnique as jest.Mock).mockResolvedValue({ id: 'gc_1' });
      ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({ id: 'usr_mgr_ad' });
      ((prisma as any).advertisementRequest.create as jest.Mock).mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'ad_gc_1',
          ...data,
          gamingCenter: { id: 'gc_1', name: 'Cyber Arena', slug: 'cyber-arena', addresses: [] },
          owner: { id: 'usr_mgr_ad', fullName: 'Ali Rezaei', phone: '09120000000', email: 'ali@example.com' },
          reviewedBy: { id: 'pa_ad_1', fullName: 'Super Admin', email: 'admin@playnest.ir' },
          media: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      const res = await request(app)
        .post('/api/v1/platform-admin/ad-requests')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          title: 'Cyber Arena Weekend Discount',
          bannerUrl: 'https://cdn.playnest.ir/banners/cyber.png',
          adType: 'GAMING_CENTER',
          gamingCenterId: 'gc_1',
          ownerId: 'usr_mgr_ad',
          priority: 10,
          durationDays: 14,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.adType).toBe('GAMING_CENTER');
      expect(res.body.data.gamingCenter.id).toBe('gc_1');
      expect(res.body.data.owner.id).toBe('usr_mgr_ad');
      expect(['APPROVED', 'ACTIVE']).toContain(res.body.data.status);
    });

    it('18. Creates a Global Promotion advertisement without a Gaming Center or Owner', async () => {
      setupAdminAuth();
      ((prisma as any).advertisementRequest.create as jest.Mock).mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'ad_global_1',
          ...data,
          gamingCenter: null,
          owner: null,
          reviewedBy: { id: 'pa_ad_1', fullName: 'Super Admin', email: 'admin@playnest.ir' },
          media: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      const res = await request(app)
        .post('/api/v1/platform-admin/ad-requests')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          title: 'Summer Global Discount 25%',
          description: '25% off on all online bookings platform-wide',
          bannerUrl: 'https://cdn.playnest.ir/banners/summer-25.png',
          adType: 'GLOBAL_PROMOTION',
          priority: 100,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.adType).toBe('GLOBAL_PROMOTION');
      expect(res.body.data.gamingCenter).toBeNull();
      expect(res.body.data.owner).toBeNull();
      expect(['APPROVED', 'ACTIVE']).toContain(res.body.data.status);
      expect((prisma as any).advertisementRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gamingCenterId: null,
            ownerId: null,
            adType: 'GLOBAL_PROMOTION',
            status: 'APPROVED',
          }),
        })
      );
    });

    it('19. Creates a Category-based advertisement without a Gaming Center', async () => {
      setupAdminAuth();
      ((prisma as any).advertisementRequest.create as jest.Mock).mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'ad_cat_1',
          ...data,
          gamingCenter: null,
          owner: null,
          reviewedBy: { id: 'pa_ad_1', fullName: 'Super Admin', email: 'admin@playnest.ir' },
          media: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      const res = await request(app)
        .post('/api/v1/platform-admin/ad-requests')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          title: 'PS5 Pro Stations Festival',
          bannerUrl: 'https://cdn.playnest.ir/banners/ps5.png',
          adType: 'CATEGORY',
          category: 'PS5',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.adType).toBe('CATEGORY');
      expect(res.body.data.category).toBe('PS5');
      expect(res.body.data.gamingCenter).toBeNull();
    });

    it('20. Creates a Custom Link advertisement and validates destinationUrl', async () => {
      setupAdminAuth();

      // Missing destinationUrl for CUSTOM_LINK should fail with 400
      const invalidRes = await request(app)
        .post('/api/v1/platform-admin/ad-requests')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          title: 'External Sponsor',
          bannerUrl: 'https://cdn.playnest.ir/banners/sponsor.png',
          adType: 'CUSTOM_LINK',
        });
      expect(invalidRes.status).toBe(400);

      // Valid CUSTOM_LINK
      ((prisma as any).advertisementRequest.create as jest.Mock).mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'ad_link_1',
          ...data,
          gamingCenter: null,
          owner: null,
          reviewedBy: { id: 'pa_ad_1', fullName: 'Super Admin', email: 'admin@playnest.ir' },
          media: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      const validRes = await request(app)
        .post('/api/v1/platform-admin/ad-requests')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          title: 'Esports Partner Event',
          bannerUrl: 'https://cdn.playnest.ir/banners/partner.png',
          adType: 'CUSTOM_LINK',
          destinationUrl: 'https://esports.example.com/register',
        });

      expect(validRes.status).toBe(201);
      expect(validRes.body.data.adType).toBe('CUSTOM_LINK');
      expect(validRes.body.data.destinationUrl).toBe('https://esports.example.com/register');
      expect(validRes.body.data.gamingCenter).toBeNull();
    });

    it('21. Public slider returns both Gaming Center and independent advertisements', async () => {
      ((prisma as any).advertisementRequest.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'ad_global_1',
          title: 'Global Sale',
          description: null,
          bannerUrl: 'https://cdn.playnest.ir/global.png',
          mediaType: 'IMAGE',
          adType: 'GLOBAL_PROMOTION',
          category: null,
          destinationUrl: null,
          priority: 100,
          startDate: new Date(),
          endDate: null,
          gamingCenter: null,
        },
        {
          id: 'ad_gc_1',
          title: 'Cyber Arena Promo',
          description: null,
          bannerUrl: 'https://cdn.playnest.ir/gc.png',
          mediaType: 'IMAGE',
          adType: 'GAMING_CENTER',
          category: null,
          destinationUrl: null,
          priority: 10,
          startDate: new Date(),
          endDate: null,
          gamingCenter: { id: 'gc_1', name: 'Cyber Arena', slug: 'cyber-arena' },
        },
      ]);

      const res = await request(app).get('/api/v1/public/advertisements/slider');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toMatchObject({
        id: 'ad_global_1',
        adType: 'GLOBAL_PROMOTION',
        gamingCenterName: null,
        gamingCenterSlug: null,
      });
      expect(res.body.data[1]).toMatchObject({
        id: 'ad_gc_1',
        adType: 'GAMING_CENTER',
        gamingCenterName: 'Cyber Arena',
        gamingCenterSlug: 'cyber-arena',
      });
    });
  });
});
