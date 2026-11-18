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

describe('GET /api/v1/public/gaming-centers/cities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns unique cities with registered active gaming centers and counts', async () => {
    (prisma.$queryRaw as jest.MockedFunction<any>).mockResolvedValue([
      { city: 'Tehran', gamingCenterCount: 12 },
      { city: 'Shiraz', gamingCenterCount: 5 },
    ]);

    const res = await request(app).get('/api/v1/public/gaming-centers/cities');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([
      { city: 'Tehran', gamingCenterCount: 12 },
      { city: 'Shiraz', gamingCenterCount: 5 },
    ]);
  });

  it('uses database-level GROUP BY, COUNT(DISTINCT), isActive visibility filter, and non-null/non-empty city filter', async () => {
    (prisma.$queryRaw as jest.MockedFunction<any>).mockResolvedValue([]);

    await PublicGamingCentersRepo.findRegisteredCities();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const callArgs = (prisma.$queryRaw as jest.MockedFunction<any>).mock.calls[0];
    const sqlText = (callArgs[0] as TemplateStringsArray).join(' ');

    expect(sqlText).toContain('GROUP BY TRIM(a."city")');
    expect(sqlText).toContain('COUNT(DISTINCT a."gamingCenterId")');
    expect(sqlText).toContain('gc."isActive" = true');
    expect(sqlText).toContain('a."city" IS NOT NULL');
    expect(sqlText).toContain('TRIM(a."city") <> \'\'');
  });

  it('excludes null, empty, whitespace-only, and zero-count cities defensively', async () => {
    (prisma.$queryRaw as jest.MockedFunction<any>).mockResolvedValue([
      { city: '  Tehran  ', gamingCenterCount: 3 },
      { city: '', gamingCenterCount: 2 },
      { city: '   ', gamingCenterCount: 1 },
      { city: null, gamingCenterCount: 4 },
      { city: 'Mashhad', gamingCenterCount: 0 },
    ]);

    const res = await request(app).get('/api/v1/public/gaming-centers/cities');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ city: 'Tehran', gamingCenterCount: 3 }]);
  });

  it('returns empty array when no active gaming centers exist', async () => {
    (prisma.$queryRaw as jest.MockedFunction<any>).mockResolvedValue([]);

    const res = await request(app).get('/api/v1/public/gaming-centers/cities');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });
});
