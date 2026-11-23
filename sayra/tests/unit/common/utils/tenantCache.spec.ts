/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { prisma } from '../../../../src/config/prisma';
import redis from '../../../../src/config/redis';
import {
  resolveTenantBySlug,
  resolveTenantByIdOrSlug,
  invalidateTenantCache,
  getTenantIdCacheKey,
  getTenantSlugCacheKey,
} from '../../../../src/common/utils/tenantCache';
import { resolveGamingCenterBySlug } from '../../../../src/common/middleware/resolveGamingCenterBySlug';
import { resolveGamingCenterParam } from '../../../../src/common/middleware/resolveGamingCenterParam';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../../../src/config/redis', () => ({
  status: 'ready',
  get: jest.fn(),
  mget: jest.fn(),
  set: jest.fn().mockResolvedValue('OK' as never),
  del: jest.fn().mockResolvedValue(1 as never),
}));

describe('Unified Redis Tenant Resolver & Cache (AMI-35)', () => {
  const originalFlag = process.env.ENABLE_TENANT_CACHE_IN_TEST;
  const sampleCenter = {
    id: 'gc-100',
    slug: 'arena-tehran',
    name: 'Arena Tehran',
    isActive: true,
    verificationStatus: 'APPROVED',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_TENANT_CACHE_IN_TEST = 'true';
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.ENABLE_TENANT_CACHE_IN_TEST;
    } else {
      process.env.ENABLE_TENANT_CACHE_IN_TEST = originalFlag;
    }
  });

  it('should serve resolveTenantBySlug from Redis without hitting Prisma on cache hit', async () => {
    (redis.get as jest.MockedFunction<any>).mockResolvedValueOnce(JSON.stringify(sampleCenter));

    const result = await resolveTenantBySlug('arena-tehran');
    expect(result).toEqual(sampleCenter);
    expect(redis.get).toHaveBeenCalledWith(getTenantSlugCacheKey('arena-tehran'));
    expect(prisma.gamingCenter.findUnique).not.toHaveBeenCalled();
  });

  it('should populate both tenant:id and tenant:slug keys on DB cache miss', async () => {
    (redis.get as jest.MockedFunction<any>).mockResolvedValueOnce(null);
    (prisma.gamingCenter.findUnique as jest.MockedFunction<any>).mockResolvedValueOnce(sampleCenter);

    const result = await resolveTenantBySlug('arena-tehran');
    expect(result).toEqual(sampleCenter);
    expect(redis.set as any).toHaveBeenCalledWith(
      getTenantIdCacheKey('gc-100'),
      expect.any(String),
      'EX',
      60
    );
    expect(redis.set as any).toHaveBeenCalledWith(
      getTenantSlugCacheKey('arena-tehran'),
      expect.any(String),
      'EX',
      60
    );
  });

  it('should reject unapproved or deactivated centers in resolveGamingCenterBySlug middleware', async () => {
    (redis.get as jest.MockedFunction<any>).mockResolvedValueOnce(
      JSON.stringify({ ...sampleCenter, verificationStatus: 'PENDING' })
    );
    const nextPending = jest.fn();
    await resolveGamingCenterBySlug({ params: { gamingCenterSlug: 'arena-tehran' } } as any, {} as any, nextPending);
    expect(nextPending).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));

    (redis.get as jest.MockedFunction<any>).mockResolvedValueOnce(
      JSON.stringify({ ...sampleCenter, isActive: false })
    );
    const nextInactive = jest.fn();
    await resolveGamingCenterBySlug({ params: { gamingCenterSlug: 'arena-tehran' } } as any, {} as any, nextInactive);
    expect(nextInactive).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('should resolve resolveTenantByIdOrSlug from Redis mget in 0 DB queries', async () => {
    (redis.mget as jest.MockedFunction<any>).mockResolvedValueOnce([JSON.stringify(sampleCenter), null]);

    const req: any = { params: { gamingCenterId: 'gc-100' } };
    const next = jest.fn();
    await new Promise((resolve) => {
      resolveGamingCenterParam(req, {} as any, (...args: any[]) => {
        next(...args);
        resolve(undefined);
      });
    });

    expect(req.tenant).toEqual({ gamingCenterId: 'gc-100', gamingCenterSlug: 'arena-tehran' });
    expect(req.gamingCenterId).toBe('gc-100');
    expect(prisma.gamingCenter.findUnique).not.toHaveBeenCalled();
    expect(prisma.gamingCenter.findFirst).not.toHaveBeenCalled();
  });

  it('should fall back gracefully in resolveTenantByIdOrSlug when Redis rejects', async () => {
    (redis.mget as jest.MockedFunction<any>).mockRejectedValueOnce(new Error('Redis down'));
    (prisma.gamingCenter.findUnique as jest.MockedFunction<any>).mockResolvedValueOnce(null);
    (prisma.gamingCenter.findFirst as jest.MockedFunction<any>).mockResolvedValueOnce(sampleCenter);

    const res = await resolveTenantByIdOrSlug('arena-tehran');
    expect(res).toEqual(sampleCenter);
  });

  it('should invalidate both ID and discovered slug keys when invalidateTenantCache is called by ID', async () => {
    (redis.get as jest.MockedFunction<any>).mockResolvedValueOnce(JSON.stringify(sampleCenter));

    await invalidateTenantCache('gc-100');

    expect(redis.del).toHaveBeenCalledWith(
      getTenantIdCacheKey('gc-100'),
      getTenantSlugCacheKey('arena-tehran')
    );
  });
});
