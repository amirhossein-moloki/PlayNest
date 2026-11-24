/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { PublicGamingCentersRepo } from '../../../src/modules/public/gamingCenters.public.repo';

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

describe('Gaming Centers Map Endpoint (GET /api/v1/public/gaming-centers/map & /api/v1/gamingCenters/map)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects requests when city query parameter is missing so all cities are never sent to frontend', async () => {
    const resPublic = await request(app).get('/api/v1/public/gaming-centers/map');
    expect(resPublic.status).toBe(400);
    expect(resPublic.body.success).toBe(false);
    expect(resPublic.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();

    const resCenters = await request(app).get('/api/v1/gamingCenters/map');
    expect(resCenters.status).toBe(400);
    expect(resCenters.body.success).toBe(false);
    expect(resCenters.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects requests when city query parameter is empty or whitespace-only', async () => {
    const res = await request(app)
      .get('/api/v1/public/gaming-centers/map')
      .query({ city: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns id, name, latitude, longitude, rating, and ratingCount for the selected city', async () => {
    (prisma.$queryRaw as jest.MockedFunction<any>).mockResolvedValue([
      {
        id: 'gc-tehran-1',
        name: 'گیم‌نت آلفا',
        latitude: '35.7152',
        longitude: '51.4043',
        rating: '4.66',
        ratingCount: '12',
        extraFieldThatShouldBeStripped: 'should-not-appear',
      },
      {
        id: 'gc-tehran-2',
        name: 'گیم‌نت بتا',
        latitude: 35.6892,
        longitude: 51.389,
      },
    ]);

    const res = await request(app)
      .get('/api/v1/public/gaming-centers/map')
      .query({ city: 'تهران' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([
      {
        id: 'gc-tehran-1',
        name: 'گیم‌نت آلفا',
        latitude: 35.7152,
        longitude: 51.4043,
        rating: 4.7,
        ratingCount: 12,
      },
      {
        id: 'gc-tehran-2',
        name: 'گیم‌نت بتا',
        latitude: 35.6892,
        longitude: 51.389,
        rating: 0,
        ratingCount: 0,
      },
    ]);

    for (const item of res.body.data) {
      expect(Object.keys(item).sort()).toEqual([
        'id',
        'latitude',
        'longitude',
        'name',
        'rating',
        'ratingCount',
      ]);
      expect(typeof item.id).toBe('string');
      expect(typeof item.name).toBe('string');
      expect(typeof item.latitude).toBe('number');
      expect(typeof item.longitude).toBe('number');
      expect(typeof item.rating).toBe('number');
      expect(typeof item.ratingCount).toBe('number');
      expect(Number.isInteger(item.ratingCount)).toBe(true);
    }
  });

  it('returns markers for the newly selected city when city changes and supports /api/v1/gamingCenters/map', async () => {
    (prisma.$queryRaw as jest.MockedFunction<any>)
      .mockResolvedValueOnce([
        {
          id: 'gc-teh-1',
          name: 'Tehran Arena',
          latitude: 35.72,
          longitude: 51.41,
          rating: 4.8,
          ratingCount: 15,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'gc-shz-1',
          name: 'Shiraz Hub',
          latitude: 29.5918,
          longitude: 52.5837,
          rating: 0,
          ratingCount: 0,
        },
      ]);

    const resTehran = await request(app)
      .get('/api/v1/gamingCenters/map')
      .query({ city: 'Tehran' });

    expect(resTehran.status).toBe(200);
    expect(resTehran.body.data).toEqual([
      {
        id: 'gc-teh-1',
        name: 'Tehran Arena',
        latitude: 35.72,
        longitude: 51.41,
        rating: 4.8,
        ratingCount: 15,
      },
    ]);

    const resShiraz = await request(app)
      .get('/api/v1/gamingCenters/map')
      .query({ city: 'Shiraz' });

    expect(resShiraz.status).toBe(200);
    expect(resShiraz.body.data).toEqual([
      {
        id: 'gc-shz-1',
        name: 'Shiraz Hub',
        latitude: 29.5918,
        longitude: 52.5837,
        rating: 0,
        ratingCount: 0,
      },
    ]);
  });

  it('enforces database-level filters for active, approved centers, city match, valid coordinates, and valid published ratings', async () => {
    (prisma.$queryRaw as jest.MockedFunction<any>).mockResolvedValue([]);

    await PublicGamingCentersRepo.findMapGamingCentersByCity('  Tehran  ');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const callArgs = (prisma.$queryRaw as jest.MockedFunction<any>).mock.calls[0];
    const sqlText = (callArgs[0] as TemplateStringsArray).join(' ');
    const cityParam = callArgs[1];

    expect(cityParam).toBe('Tehran');
    expect(sqlText).toContain('SELECT DISTINCT ON (gc."id")');
    expect(sqlText).toContain('gc."isActive" = true');
    expect(sqlText).toContain('gc."verificationStatus" = \'APPROVED\'');
    expect(sqlText).toContain('LOWER(TRIM(a."city")) = LOWER(TRIM(');
    expect(sqlText).toContain('a."lat" IS NOT NULL');
    expect(sqlText).toContain('a."lng" IS NOT NULL');
    expect(sqlText).toContain('a."lat" BETWEEN -90 AND 90');
    expect(sqlText).toContain('a."lng" BETWEEN -180 AND 180');
    expect(sqlText).toContain('LEFT JOIN LATERAL');
    expect(sqlText).toContain('FROM "Rating" r');
    expect(sqlText).toContain('INNER JOIN "Reservation" res ON res."id" = r."reservationId"');
    expect(sqlText).toContain('r."status" = \'PUBLISHED\'');
    expect(sqlText).toContain('res."status" = \'COMPLETED\'');
    expect(sqlText).toContain('r."rating" BETWEEN 1 AND 5');
    expect(sqlText).toContain('AVG(r."rating")');
    expect(sqlText).toContain('COUNT(r."id")');
  });

  it('defensively filters out gaming centers without valid coordinates or duplicate IDs', async () => {
    (prisma.$queryRaw as jest.MockedFunction<any>).mockResolvedValue([
      { id: 'gc-valid', name: 'Valid Center', latitude: 35.7, longitude: 51.4 },
      { id: 'gc-valid', name: 'Duplicate Center', latitude: 35.71, longitude: 51.41 },
      { id: 'gc-null-lat', name: 'Null Lat', latitude: null, longitude: 51.4 },
      { id: 'gc-null-lng', name: 'Null Lng', latitude: 35.7, longitude: null },
      { id: 'gc-zero', name: 'Zero Coords', latitude: 0, longitude: 0 },
      { id: 'gc-out-of-range-lat', name: 'Invalid Lat', latitude: 120, longitude: 51.4 },
      { id: 'gc-out-of-range-lng', name: 'Invalid Lng', latitude: 35.7, longitude: -195 },
      { id: 'gc-nan', name: 'NaN Coords', latitude: 'invalid', longitude: 51.4 },
      { id: '', name: 'Missing ID', latitude: 35.7, longitude: 51.4 },
      { id: 'gc-no-name', name: '   ', latitude: 35.7, longitude: 51.4 },
    ]);

    const res = await request(app)
      .get('/api/v1/public/gaming-centers/map')
      .query({ city: 'Tehran' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        id: 'gc-valid',
        name: 'Valid Center',
        latitude: 35.7,
        longitude: 51.4,
        rating: 0,
        ratingCount: 0,
      },
    ]);
  });

  it('normalizes edge-case rating and ratingCount values without dropping centers', async () => {
    (prisma.$queryRaw as jest.MockedFunction<any>).mockResolvedValue([
      {
        id: 'gc-null-rating',
        name: 'Unrated Center',
        latitude: 35.7,
        longitude: 51.4,
        rating: null,
        ratingCount: null,
      },
      {
        id: 'gc-clamped-rating',
        name: 'Clamped Center',
        latitude: 35.71,
        longitude: 51.41,
        rating: 6.4,
        ratingCount: 5.9,
      },
      {
        id: 'gc-negative-rating',
        name: 'Negative Center',
        latitude: 35.72,
        longitude: 51.42,
        rating: -1,
        ratingCount: -3,
      },
      {
        id: 'gc-invalid-rating',
        name: 'Invalid String Rating',
        latitude: 35.73,
        longitude: 51.43,
        rating: 'not-a-number',
        ratingCount: 'bad',
      },
    ]);

    const res = await request(app)
      .get('/api/v1/public/gaming-centers/map')
      .query({ city: 'Tehran' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        id: 'gc-null-rating',
        name: 'Unrated Center',
        latitude: 35.7,
        longitude: 51.4,
        rating: 0,
        ratingCount: 0,
      },
      {
        id: 'gc-clamped-rating',
        name: 'Clamped Center',
        latitude: 35.71,
        longitude: 51.41,
        rating: 5,
        ratingCount: 5,
      },
      {
        id: 'gc-negative-rating',
        name: 'Negative Center',
        latitude: 35.72,
        longitude: 51.42,
        rating: 0,
        ratingCount: 0,
      },
      {
        id: 'gc-invalid-rating',
        name: 'Invalid String Rating',
        latitude: 35.73,
        longitude: 51.43,
        rating: 0,
        ratingCount: 0,
      },
    ]);
  });
});
