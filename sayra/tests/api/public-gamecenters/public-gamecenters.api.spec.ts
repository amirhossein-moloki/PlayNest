/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';

const mockPrisma: any = {
  gamingCenter: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  gamingCenterSlugHistory: {
    findUnique: jest.fn(),
  },
  rating: {
    findMany: jest.fn(),
  },
};

jest.mock('../../../src/config/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('../../../src/common/utils/publicCache', () => {
  const actual = jest.requireActual('../../../src/common/utils/publicCache') as any;
  return {
    ...actual,
    withPublicCache: jest.fn(async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
      fetcher()
    ),
  };
});

import app from '../../../src/app';

const FORBIDDEN_PRIVATE_KEYS = new Set([
  'owner',
  'ownerId',
  'manager',
  'managerId',
  'phone',
  'email',
  'password',
  'passwordHash',
  'verificationDocuments',
  'reservations',
  'commissionRate',
]);

function assertNoPrivateKeys(value: unknown, trail = 'root'): void {
  if (Array.isArray(value)) {
    value.forEach((item, idx) => assertNoPrivateKeys(item, `${trail}[${idx}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_PRIVATE_KEYS.has(key)) {
        throw new Error(`Private field "${key}" leaked at ${trail}.${key}`);
      }
      assertNoPrivateKeys(nested, `${trail}.${key}`);
    }
  }
}

function makeDbCenter(overrides: Record<string, any> = {}) {
  return {
    id: 'gc-tabriz-1',
    name: 'گیم‌نت سایرا تبریز',
    slug: 'sayra-tabriz-1',
    description: 'مرکز بازی حرفه‌ای در ولیعصر تبریز',
    isActive: true,
    verificationStatus: 'APPROVED',
    pcCount: 15,
    consoleCount: 8,
    openingTime: '00:00',
    closingTime: '23:59',
    timezone: 'Asia/Tehran',
    hourlyRate: 120000,
    vipHourlyRate: 180000,
    hasFoodService: true,
    games: ['FC 25', 'CS2', 'Dota 2'],
    ownerId: 'secret-owner-id',
    phone: '04133334444',
    email: 'private@example.com',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    updatedAt: new Date('2026-10-01T10:00:00Z'),
    addresses: [
      {
        province: 'آذربایجان شرقی',
        city: 'تبریز',
        district: 'ولیعصر',
        addressLine: 'تبریز، ولیعصر، خیابان نظامی پلاک ۱۲',
        lat: 38.0667,
        lng: 46.3511,
        isPrimary: true,
        createdAt: new Date('2026-08-01T10:00:00Z'),
      },
    ],
    stations: [
      {
        id: 'st-1',
        stationType: 'PS5',
        name: 'PS5 #1',
        hourlyPrice: 120000,
        isVip: false,
        isActive: true,
      },
      {
        id: 'st-2',
        stationType: 'PC',
        name: 'PC VIP #1',
        hourlyPrice: 150000,
        isVip: true,
        isActive: true,
      },
    ],
    settings: {
      workStartTime: '00:00',
      workEndTime: '23:59',
      timeZone: 'Asia/Tehran',
      allowOnlineBooking: true,
    },
    media: [
      {
        url: 'https://cdn.example.com/gc1-cover.webp',
        thumbUrl: 'https://cdn.example.com/gc1-thumb.webp',
        altText: 'نمای سالن گیم‌نت',
        purpose: 'COVER',
        isActive: true,
        sortOrder: 0,
      },
    ],
    discounts: [],
    discountCampaigns: [],
    closures: [],
    centerGames: [{ id: 'cg-1' }],
    stationExtraControllers: [{ id: 'ec-1' }],
    ...overrides,
  };
}

describe('Public GameCenters V2 API (/api/public/gamecenters & /api/v1/public/gamecenters)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.gamingCenterSlugHistory.findUnique.mockResolvedValue(null);
  });

  it('lists active & approved gaming centers with sanitized DTOs on both /api/public and /api/v1/public', async () => {
    const c1 = makeDbCenter();
    mockPrisma.gamingCenter.findMany.mockResolvedValue([c1]);
    mockPrisma.gamingCenter.count.mockResolvedValue(1);
    mockPrisma.rating.findMany.mockResolvedValue([
      {
        gamingCenterId: 'gc-tabriz-1',
        rating: 5,
        createdAt: new Date('2026-10-01T12:00:00Z'),
      },
      {
        gamingCenterId: 'gc-tabriz-1',
        rating: 4,
        createdAt: new Date('2026-10-02T12:00:00Z'),
      },
    ]);

    const res = await request(app).get('/api/public/gamecenters').query({
      city: 'تبریز',
      neighborhood: 'ولیعصر',
      amenities: 'food_service,vip',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.meta).toEqual({
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const dto = res.body.data.data[0];
    expect(dto.id).toBe('gc-tabriz-1');
    expect(dto.city).toBe('تبریز');
    expect(dto.neighborhood).toBe('ولیعصر');
    expect(dto.rating.average).toBe(4.5);
    expect(dto.rating.validReviewsCount).toBe(2);
    expect(dto.detailUrl).toBe('/gamecenter/sayra-tabriz-1');
    expect(dto.amenities).toContain('food_service');
    expect(dto.amenities).toContain('vip');

    assertNoPrivateKeys(res.body);

    const findManyWhere = mockPrisma.gamingCenter.findMany.mock.calls[0][0].where;
    expect(findManyWhere.isActive).toBe(true);
    expect(findManyWhere.verificationStatus).toBe('APPROVED');

    const ratingWhere = mockPrisma.rating.findMany.mock.calls[0][0].where;
    expect(ratingWhere.status).toBe('PUBLISHED');
    expect(ratingWhere.reservation).toEqual({ status: 'COMPLETED' });

    const resV1 = await request(app).get('/api/v1/public/gamecenters');
    expect(resV1.status).toBe(200);
  });

  it('supports batch lookup by ?ids=... preserving input order and rejects >50 IDs with 400', async () => {
    const c1 = makeDbCenter({ id: 'gc-1', slug: 'gc-1' });
    const c2 = makeDbCenter({ id: 'gc-2', slug: 'gc-2', name: 'گیم‌نت دوم' });
    // Prisma returns c1 before c2; repo must preserve ?ids=gc-2,gc-1 order
    mockPrisma.gamingCenter.findMany.mockResolvedValue([c1, c2]);
    mockPrisma.rating.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/public/gamecenters')
      .query({ ids: 'gc-2,gc-1' });

    expect(res.status).toBe(200);
    expect(res.body.data.data.map((d: any) => d.id)).toEqual(['gc-2', 'gc-1']);
    expect(mockPrisma.gamingCenter.findMany).toHaveBeenCalledTimes(1);

    const tooManyIds = Array.from({ length: 51 }, (_, i) => `gc-${i}`).join(',');
    const errRes = await request(app)
      .get('/api/public/gamecenters')
      .query({ ids: tooManyIds });
    expect(errRes.status).toBe(400);
    expect(errRes.body.success).toBe(false);
  });

  it('returns 404 when single gaming center is inactive or unapproved', async () => {
    mockPrisma.gamingCenter.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/public/gamecenters/unapproved-center');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);

    const where = mockPrisma.gamingCenter.findFirst.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.verificationStatus).toBe('APPROVED');
  });

  it('returns single sanitized gaming center by ID or slug', async () => {
    mockPrisma.gamingCenter.findFirst.mockResolvedValue(makeDbCenter());
    mockPrisma.rating.findMany.mockResolvedValue([
      {
        gamingCenterId: 'gc-tabriz-1',
        rating: 5,
        createdAt: new Date('2026-10-01T12:00:00Z'),
      },
      {
        gamingCenterId: 'gc-tabriz-1',
        rating: 5,
        createdAt: new Date('2026-10-02T12:00:00Z'),
      },
      {
        gamingCenterId: 'gc-tabriz-1',
        rating: 4,
        createdAt: new Date('2026-10-03T12:00:00Z'),
      },
    ]);

    const res = await request(app).get('/api/public/gamecenters/sayra-tabriz-1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('gc-tabriz-1');
    expect(res.body.data.rating.validReviewsCount).toBe(3);
    expect(res.body.data.rating.average).toBe(4.67);
    assertNoPrivateKeys(res.body);
  });

  it('computes Bayesian rankings and separates ranked vs newlyRegistered centers', async () => {
    const topCenter = makeDbCenter({ id: 'gc-top', slug: 'top-tabriz', name: 'برتر تبریز' });
    const midCenter = makeDbCenter({ id: 'gc-mid', slug: 'mid-tabriz', name: 'میانی تبریز' });
    const newCenter = makeDbCenter({
      id: 'gc-new',
      slug: 'new-tabriz',
      name: 'تازه‌ثبت تبریز',
      createdAt: new Date('2026-11-01T10:00:00Z'),
    });

    mockPrisma.gamingCenter.findMany.mockResolvedValue([topCenter, midCenter, newCenter]);
    mockPrisma.rating.findMany.mockResolvedValue([
      { gamingCenterId: 'gc-top', rating: 5, createdAt: new Date('2026-10-10T10:00:00Z') },
      { gamingCenterId: 'gc-top', rating: 5, createdAt: new Date('2026-10-11T10:00:00Z') },
      { gamingCenterId: 'gc-top', rating: 5, createdAt: new Date('2026-10-12T10:00:00Z') },
      { gamingCenterId: 'gc-mid', rating: 4, createdAt: new Date('2026-10-01T10:00:00Z') },
      { gamingCenterId: 'gc-mid', rating: 4, createdAt: new Date('2026-10-02T10:00:00Z') },
      { gamingCenterId: 'gc-mid', rating: 4, createdAt: new Date('2026-10-03T10:00:00Z') },
      { gamingCenterId: 'gc-new', rating: 5, createdAt: new Date('2026-11-02T10:00:00Z') },
    ]);

    const res = await request(app).get('/api/public/gamecenters/rankings').query({
      city: 'تبریز',
      m: 3,
      minReviews: 3,
      limit: 10,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { ranked, newlyRegistered, methodology } = res.body.data;
    expect(ranked.map((r: any) => r.id)).toEqual(['gc-top', 'gc-mid']);
    expect(ranked[0].ranking.rank).toBe(1);
    expect(ranked[1].ranking.rank).toBe(2);

    expect(newlyRegistered.map((r: any) => r.id)).toEqual(['gc-new']);
    expect(newlyRegistered[0].ranking.isEligibleForRanking).toBe(false);
    expect(newlyRegistered[0].ranking.rank).toBeNull();

    expect(methodology.algorithm).toBe('bayesian_average');
    expect(methodology.m).toBe(3);
    expect(methodology.minReviews).toBe(3);
    expect(methodology.scopeTotalValidReviews).toBe(7);
    expect(methodology.rankedCount).toBe(2);
    expect(methodology.newlyRegisteredCount).toBe(1);

    assertNoPrivateKeys(res.body);
  });
});
