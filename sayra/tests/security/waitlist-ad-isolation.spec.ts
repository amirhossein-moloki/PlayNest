/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  AdvertisementRequestStatus,
  MediaType,
  SessionActorType,
  UserRole,
} from '@prisma/client';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { generateAccessToken } from '../../src/modules/auth/auth.tokens';

jest.mock('../../src/config/redis', () => {
  const mockRedis: any = {
    status: 'ready',
    get: jest.fn(async () => null),
    set: jest.fn(async () => 'OK'),
    del: jest.fn(async () => 1),
    scan: jest.fn(async () => ['0', []]),
  };
  return {
    __esModule: true,
    redis: mockRedis,
    default: mockRedis,
  };
});

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
    waitlistEntry: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    media: {
      findFirst: jest.fn(),
    },
    advertisementRequest: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('SEC-031: Waitlist Middleware Order & Cross-Tenant Advertisement Media Isolation', () => {
  const centerA = 'c111111111111111111111111';
  const centerB = 'c222222222222222222222222';
  const managerAId = 'c333333333333333333333333';
  const managerBId = 'c444444444444444444444444';
  const staffAId = 'c555555555555555555555555';
  const mediaAId = 'c666666666666666666666666';
  const mediaBId = 'c777777777777777777777777';
  const adId = 'c888888888888888888888888';

  let managerAToken: string;
  let managerBToken: string;
  let staffAToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation((async (cb: any) => cb(prisma)) as any);

    managerAToken = generateAccessToken({
      sessionId: 'sess_mgr_a',
      actorId: managerAId,
      actorType: SessionActorType.USER,
    });
    managerBToken = generateAccessToken({
      sessionId: 'sess_mgr_b',
      actorId: managerBId,
      actorType: SessionActorType.USER,
    });
    staffAToken = generateAccessToken({
      sessionId: 'sess_staff_a',
      actorId: staffAId,
      actorType: SessionActorType.USER,
    });

    (prisma.session.findUnique as jest.Mock).mockResolvedValue({
      id: 'sess_active',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 600_000),
    } as never);

    (prisma.gamingCenter.findUnique as jest.Mock).mockImplementation((async (args: any) => {
      if (args?.where?.id === centerA) {
        return { id: centerA, slug: 'center-a', name: 'Center A', isActive: true };
      }
      if (args?.where?.id === centerB) {
        return { id: centerB, slug: 'center-b', name: 'Center B', isActive: true };
      }
      return null;
    }) as any);

    (prisma.user.findUnique as jest.Mock).mockImplementation((async (args: any) => {
      if (args?.where?.id === managerAId) {
        return { id: managerAId, gamingCenterId: centerA, role: UserRole.MANAGER, isActive: true };
      }
      if (args?.where?.id === managerBId) {
        return { id: managerBId, gamingCenterId: centerB, role: UserRole.MANAGER, isActive: true };
      }
      if (args?.where?.id === staffAId) {
        return { id: staffAId, gamingCenterId: centerA, role: UserRole.STAFF, isActive: true };
      }
      return null;
    }) as any);

    (prisma.waitlistEntry.findMany as jest.Mock).mockResolvedValue([] as never);
    (prisma.waitlistEntry.count as jest.Mock).mockResolvedValue(0 as never);
  });

  it('1. Admin waitlist routes authenticate before tenantGuard (401 unauth, 403 staff, 404 cross-tenant, 200 owner)', async () => {
    const unauthRes = await request(app).get(`/api/v1/gamingCenters/${centerA}/waitlist`);
    expect(unauthRes.status).toBe(401);

    const staffRes = await request(app)
      .get(`/api/v1/gamingCenters/${centerA}/waitlist`)
      .set('Authorization', `Bearer ${staffAToken}`);
    expect(staffRes.status).toBe(403);

    const crossTenantRes = await request(app)
      .get(`/api/v1/gamingCenters/${centerA}/waitlist`)
      .set('Authorization', `Bearer ${managerBToken}`);
    expect(crossTenantRes.status).toBe(404);

    const okRes = await request(app)
      .get(`/api/v1/gamingCenters/${centerA}/waitlist`)
      .set('Authorization', `Bearer ${managerAToken}`);
    expect(okRes.status).toBe(200);
    expect(okRes.body.success).toBe(true);
  });

  it('2. Rejects cross-tenant mediaId on advertisement create & update (404) and allows own-tenant mediaId', async () => {
    (prisma.media.findFirst as jest.Mock).mockImplementation((async (args: any) => {
      if (args?.where?.id === mediaAId && args?.where?.gamingCenterId === centerA) {
        return { id: mediaAId };
      }
      return null;
    }) as any);

    // Cross-tenant mediaId on POST create -> 404
    const crossCreateRes = await request(app)
      .post(`/api/v1/gamingCenters/${centerA}/advertisements`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        title: 'Cross-Tenant Ad Media',
        bannerUrl: 'https://cdn.sayra-booking.ir/banner.png',
        mediaType: MediaType.IMAGE,
        mediaId: mediaBId,
      });
    expect(crossCreateRes.status).toBe(404);
    expect(prisma.advertisementRequest.create).not.toHaveBeenCalled();

    // Own-tenant mediaId on POST create -> 201
    (prisma.advertisementRequest.create as jest.Mock).mockResolvedValueOnce({
      id: adId,
      title: 'Own Media Ad',
      description: null,
      bannerUrl: 'https://cdn.sayra-booking.ir/banner.png',
      destinationUrl: null,
      mediaType: MediaType.IMAGE,
      mediaId: mediaAId,
      shortLinkId: null,
      proposedDurationDays: 30,
      durationDays: 30,
      priority: 0,
      startDate: null,
      endDate: null,
      status: AdvertisementRequestStatus.PENDING,
      gamingCenterId: centerA,
      ownerId: managerAId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const ownCreateRes = await request(app)
      .post(`/api/v1/gamingCenters/${centerA}/advertisements`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        title: 'Own Media Ad',
        bannerUrl: 'https://cdn.sayra-booking.ir/banner.png',
        mediaType: MediaType.IMAGE,
        mediaId: mediaAId,
      });
    expect(ownCreateRes.status).toBe(201);

    // Cross-tenant mediaId on PATCH update -> 404
    (prisma.advertisementRequest.findFirst as jest.Mock).mockResolvedValue({
      id: adId,
      gamingCenterId: centerA,
      status: AdvertisementRequestStatus.PENDING,
      deletedAt: null,
    } as never);

    const crossUpdateRes = await request(app)
      .patch(`/api/v1/gamingCenters/${centerA}/advertisements/${adId}`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({ mediaId: mediaBId });
    expect(crossUpdateRes.status).toBe(404);
    expect(prisma.advertisementRequest.update).not.toHaveBeenCalled();
  });
});
