/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  Prisma,
  RatingStatus,
  ReservationStatus,
  SessionActorType,
  UserRole,
} from '@prisma/client';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { generateAccessToken } from '../../src/modules/auth/auth.tokens';
import { CustomerPanelStation } from '../../src/modules/customer-panel/customer-panel.station';
import { CustomerPanelRepo } from '../../src/modules/customer-panel/customer-panel.repo';
import * as CustomersRepo from '../../src/modules/customers/customers.repo';

jest.mock('../../src/jobs/producers/analytics.producer', () => ({
  queueAnalyticsSync: jest.fn(async () => undefined),
}));

jest.mock('../../src/modules/analytics/analytics.repo', () => ({
  AnalyticsRepo: {
    syncAllStatsForReview: jest.fn(async () => undefined),
  },
}));

jest.mock('../../src/modules/notifications/notifications.station', () => ({
  NotificationStation: {
    notifyGameCenter: jest.fn(async () => []),
    notifyManagers: jest.fn(async () => []),
  },
}));

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
    },
    user: {
      findUnique: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    customerProfile: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
    reservation: {
      findFirst: jest.fn(),
    },
    rating: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    platformSetting: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    outboxEvent: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    analyticsDaily: {
      findMany: jest.fn(),
    },
  },
}));

describe('SEC-029: Ratings Auth, Ownership, NULL-Station Duplicate Prevention & Customer Privacy', () => {
  const gamingCenterId = 'c111111111111111111111111';
  const gamingCenterSlug = 'arena-pro';
  const reservationId = 'c222222222222222222222222';
  const otherReservationId = 'c333333333333333333333333';
  const stationId = 'c444444444444444444444444';
  const spoofedStationId = 'c555555555555555555555555';
  const customerId = 'c666666666666666666666666';
  const victimCustomerId = 'c777777777777777777777777';
  const staffUserId = 'c888888888888888888888888';

  let customerToken: string;
  let staffToken: string;

  beforeEach(() => {
    jest.clearAllMocks();

    customerToken = generateAccessToken({
      sessionId: 'sess_cust_sec029',
      actorId: customerId,
      actorType: SessionActorType.CUSTOMER,
    });
    staffToken = generateAccessToken({
      sessionId: 'sess_staff_sec029',
      actorId: staffUserId,
      actorType: SessionActorType.USER,
    });

    (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue({
      id: gamingCenterId,
      slug: gamingCenterSlug,
      name: 'Arena Pro',
      isActive: true,
      verificationStatus: 'APPROVED',
    } as never);

    (prisma.session.findUnique as jest.Mock).mockResolvedValue({
      id: 'sess_active',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 600_000),
    } as never);

    (prisma.customerAccount.findUnique as jest.Mock).mockResolvedValue({
      id: customerId,
      phone: '09121112233',
      fullName: 'Sara Player',
    } as never);

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: staffUserId,
      gamingCenterId,
      role: UserRole.MANAGER,
      isActive: true,
      phone: '09129990000',
      fullName: 'Center Manager',
    } as never);

    (prisma.platformSetting.findFirst as jest.Mock).mockResolvedValue(null as never);
    (prisma.platformSetting.findUnique as jest.Mock).mockResolvedValue(null as never);
    ((prisma as any).outboxEvent.create as jest.Mock).mockResolvedValue({ id: 'outbox_1' } as never);
  });

  it('1. Rejects unauthenticated and non-CUSTOMER callers on public review POST (401 / 403)', async () => {
    const unauthRes = await request(app)
      .post(`/api/v1/public/gamingCenters/${gamingCenterSlug}/reservation/${reservationId}/ratings`)
      .send({ rating: 5, comment: 'Unauthenticated review attempt' });
    expect(unauthRes.status).toBe(401);

    const nonCustomerRes = await request(app)
      .post(`/api/v1/public/gamingCenters/${gamingCenterSlug}/reservation/${reservationId}/ratings`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ rating: 5, comment: 'Staff spoofing review' });
    expect(nonCustomerRes.status).toBe(403);
    expect(prisma.rating.create).not.toHaveBeenCalled();
  });

  it('2. Enforces reservation ownership, parameter binding, station binding, and comment max length', async () => {
    // Another customer's completed reservation -> 403 Forbidden
    (prisma.reservation.findFirst as jest.Mock).mockResolvedValueOnce({
      id: reservationId,
      gamingCenterId,
      customerAccountId: victimCustomerId,
      stationId: null,
      status: ReservationStatus.COMPLETED,
    } as never);

    const foreignRes = await request(app)
      .post(`/api/v1/public/gamingCenters/${gamingCenterSlug}/reservation/${reservationId}/ratings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 1, comment: 'Not my reservation' });
    expect(foreignRes.status).toBe(403);
    expect(prisma.rating.create).not.toHaveBeenCalled();

    // Mismatched body.reservationId -> 400 Bad Request
    const mismatchedBodyIdRes = await request(app)
      .post(`/api/v1/public/gamingCenters/${gamingCenterSlug}/reservation/${reservationId}/ratings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reservationId: otherReservationId, rating: 5 });
    expect(mismatchedBodyIdRes.status).toBe(400);

    // Comment > 1000 chars -> 400 Bad Request
    const longCommentRes = await request(app)
      .post(`/api/v1/public/gamingCenters/${gamingCenterSlug}/reservation/${reservationId}/ratings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 5, comment: 'x'.repeat(1001) });
    expect(longCommentRes.status).toBe(400);

    // Mismatched body.stationId -> 400 Bad Request
    (prisma.reservation.findFirst as jest.Mock).mockResolvedValueOnce({
      id: reservationId,
      gamingCenterId,
      customerAccountId: customerId,
      stationId,
      status: ReservationStatus.COMPLETED,
    } as never);
    const mismatchedStationRes = await request(app)
      .post(`/api/v1/public/gamingCenters/${gamingCenterSlug}/reservation/${reservationId}/ratings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 5, stationId: spoofedStationId });
    expect(mismatchedStationRes.status).toBe(400);
    expect(prisma.rating.create).not.toHaveBeenCalled();

    // Valid customer review without body.reservationId or body.stationId derives both from route & DB reservation
    (prisma.reservation.findFirst as jest.Mock).mockResolvedValueOnce({
      id: reservationId,
      gamingCenterId,
      customerAccountId: customerId,
      stationId,
      status: ReservationStatus.COMPLETED,
    } as never);
    (prisma.rating.findFirst as jest.Mock).mockResolvedValueOnce(null as never);
    (prisma.rating.create as jest.Mock).mockResolvedValueOnce({
      id: 'rating_ok_1',
      gamingCenterId,
      customerAccountId: customerId,
      reservationId,
      stationId,
      rating: 5,
      comment: 'Great setup!',
      status: RatingStatus.PUBLISHED,
    } as never);

    const okRes = await request(app)
      .post(`/api/v1/public/gamingCenters/${gamingCenterSlug}/reservation/${reservationId}/ratings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 5, comment: 'Great setup!' });
    expect(okRes.status).toBe(201);
    expect(prisma.rating.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gamingCenterId,
          customerAccountId: customerId,
          reservationId,
          stationId,
        }),
      })
    );
  });

  it('3. Blocks duplicate NULL-station reviews on public and customer-panel flows (409 Conflict)', async () => {
    (prisma.reservation.findFirst as jest.Mock).mockResolvedValue({
      id: reservationId,
      gamingCenterId,
      customerAccountId: customerId,
      stationId: null,
      status: ReservationStatus.COMPLETED,
    } as never);

    // Public route detects existing NULL-station review and rejects with 409
    (prisma.rating.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'rating_existing_null',
      reservationId,
      stationId: null,
    } as never);

    const dupPublicRes = await request(app)
      .post(`/api/v1/public/gamingCenters/${gamingCenterSlug}/reservation/${reservationId}/ratings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 5, comment: 'Duplicate flood' });
    expect(dupPublicRes.status).toBe(409);
    expect(prisma.rating.create).not.toHaveBeenCalled();

    // CustomerPanelStation.submitReview also blocks NULL-station duplicates and P2002 races with 409
    jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValue({
      id: reservationId,
      gamingCenterId,
      customerAccountId: customerId,
      stationId: null,
      status: ReservationStatus.COMPLETED,
    } as any);
    (prisma.rating.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'rating_existing_null',
      reservationId,
      stationId: null,
    } as never);

    await expect(
      CustomerPanelStation.submitReview(reservationId, customerId, { rating: 4 })
    ).rejects.toMatchObject({ statusCode: 409 });

    // Even if findFirst raced and DB throws P2002 from partial unique index, it maps to 409
    (prisma.rating.findFirst as jest.Mock).mockResolvedValueOnce(null as never);
    (prisma.rating.create as jest.Mock).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }) as never
    );

    await expect(
      CustomerPanelStation.submitReview(reservationId, customerId, { rating: 4 })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('4. CustomersRepo never overwrites global fullName on upsert and omits walletBalance/reservedBalance in tenant selects', async () => {
    (prisma.customerAccount.upsert as jest.Mock).mockResolvedValue({
      id: customerId,
      phone: '09121112233',
      fullName: 'Real Customer Name',
    } as never);

    await CustomersRepo.upsertCustomerAccount('09121112233', 'Spoofed By Tenant');
    expect(prisma.customerAccount.upsert).toHaveBeenCalledWith({
      where: { phone: '09121112233' },
      update: {},
      create: {
        phone: '09121112233',
        fullName: 'Spoofed By Tenant',
      },
    });

    (prisma.customerProfile.findMany as jest.Mock).mockResolvedValue([] as never);
    (prisma.customerProfile.count as jest.Mock).mockResolvedValue(0 as never);
    await CustomersRepo.findManyProfiles(gamingCenterId, { page: 1, limit: 10 });
    expect(prisma.customerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          customerAccount: {
            select: expect.not.objectContaining({
              walletBalance: true,
              reservedBalance: true,
            }),
          },
        },
      })
    );
    const manySelect = (prisma.customerProfile.findMany as jest.Mock).mock.calls[0][0] as any;
    expect(manySelect.include.customerAccount.select.walletBalance).toBeUndefined();
    expect(manySelect.include.customerAccount.select.reservedBalance).toBeUndefined();

    (prisma.customerProfile.findFirst as jest.Mock).mockResolvedValue(null as never);
    await CustomersRepo.findProfileById(gamingCenterId, 'prof_1');
    const byIdCall = (prisma.customerProfile.findFirst as jest.Mock).mock.calls[0][0] as any;
    expect(byIdCall.include.customerAccount.select.walletBalance).toBeUndefined();
    expect(byIdCall.include.customerAccount.select.reservedBalance).toBeUndefined();

    (prisma.customerProfile.create as jest.Mock).mockResolvedValue({ id: 'prof_1' } as never);
    await CustomersRepo.createProfile({ gamingCenterId, customerAccountId: customerId });
    const createCall = (prisma.customerProfile.create as jest.Mock).mock.calls[0][0] as any;
    expect(createCall.include.customerAccount.select.walletBalance).toBeUndefined();
    expect(createCall.include.customerAccount.select.reservedBalance).toBeUndefined();

    (prisma.customerProfile.updateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);
    (prisma.customerProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'prof_1' } as never);
    await CustomersRepo.updateProfile('prof_1', gamingCenterId, { note: 'safe' });
    const updateCall = (prisma.customerProfile.findUnique as jest.Mock).mock.calls[0][0] as any;
    expect(updateCall.include.customerAccount.select.walletBalance).toBeUndefined();
    expect(updateCall.include.customerAccount.select.reservedBalance).toBeUndefined();
  });
});
