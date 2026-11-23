/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { prisma } from '../../../../src/config/prisma';
import redis from '../../../../src/config/redis';
import {
  PlatformSettingsRepo,
  PLATFORM_SETTINGS_CACHE_KEY,
  PLATFORM_SETTINGS_INVALIDATE_CHANNEL,
  clearPlatformSettingsCache,
} from '../../../../src/modules/platform-admin/settings.station';
import { maintenanceModeMiddleware } from '../../../../src/common/middleware/maintenanceMode';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    platformSetting: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock('../../../../src/config/redis', () => ({
  status: 'ready',
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK' as never),
  del: jest.fn().mockResolvedValue(1 as never),
  publish: jest.fn().mockResolvedValue(1 as never),
}));

describe('PlatformSettings Hybrid L1 + Redis Cache (AMI-35)', () => {
  const originalFlag = process.env.ENABLE_SETTINGS_CACHE_IN_TEST;

  beforeEach(() => {
    jest.clearAllMocks();
    clearPlatformSettingsCache();
    process.env.ENABLE_SETTINGS_CACHE_IN_TEST = 'true';
  });

  afterEach(() => {
    clearPlatformSettingsCache();
    if (originalFlag === undefined) {
      delete process.env.ENABLE_SETTINGS_CACHE_IN_TEST;
    } else {
      process.env.ENABLE_SETTINGS_CACHE_IN_TEST = originalFlag;
    }
  });

  it('should serve from L1 memory cache within 5s after DB load without repeat SQL or Redis reads', async () => {
    const dbSettings = { id: 'default', maintenanceMode: false, siteTitle: 'PlayNest' };
    (redis.get as jest.MockedFunction<any>).mockResolvedValueOnce(null);
    ((prisma as any).platformSetting.findUnique as jest.MockedFunction<any>).mockResolvedValueOnce(dbSettings);

    const first = await PlatformSettingsRepo.getSettings();
    const second = await PlatformSettingsRepo.getSettings();

    expect(first).toEqual(dbSettings);
    expect(second).toEqual(dbSettings);
    expect((prisma as any).platformSetting.findUnique).toHaveBeenCalledTimes(1);
    expect(redis.get).toHaveBeenCalledTimes(1);
    expect(redis.set as any).toHaveBeenCalledWith(
      PLATFORM_SETTINGS_CACHE_KEY,
      JSON.stringify(dbSettings),
      'EX',
      30
    );
  });

  it('should serve from Redis on L1 miss without hitting PostgreSQL', async () => {
    const cachedSettings = { id: 'default', maintenanceMode: true, maintenanceMessage: 'Down for upgrade' };
    (redis.get as jest.MockedFunction<any>).mockResolvedValueOnce(JSON.stringify(cachedSettings));

    const result = await PlatformSettingsRepo.getSettings();

    expect(result).toEqual(cachedSettings);
    expect((prisma as any).platformSetting.findUnique).not.toHaveBeenCalled();

    // Subsequent call hits L1
    const second = await PlatformSettingsRepo.getSettings();
    expect(second).toEqual(cachedSettings);
    expect(redis.get).toHaveBeenCalledTimes(1);
  });

  it('should clear L1 cache, delete Redis key, publish invalidation, and toggle maintenanceMode immediately', async () => {
    const initial = { id: 'default', maintenanceMode: false, maintenanceMessage: 'Active' };
    const updated = { id: 'default', maintenanceMode: true, maintenanceMessage: 'Maintenance active' };

    (redis.get as jest.MockedFunction<any>).mockResolvedValueOnce(null);
    ((prisma as any).platformSetting.findUnique as jest.MockedFunction<any>).mockResolvedValueOnce(initial);

    const nextFn = jest.fn();
    await maintenanceModeMiddleware(
      { originalUrl: '/api/v1/gamingCenters', url: '/api/v1/gamingCenters' } as any,
      {} as any,
      nextFn
    );
    expect(nextFn).toHaveBeenCalledWith();

    ((prisma as any).platformSetting.upsert as jest.MockedFunction<any>).mockResolvedValueOnce(updated);
    await PlatformSettingsRepo.updateSettings({ maintenanceMode: true } as any);

    expect(redis.del).toHaveBeenCalledWith(PLATFORM_SETTINGS_CACHE_KEY);
    expect(redis.publish).toHaveBeenCalledWith(PLATFORM_SETTINGS_INVALIDATE_CHANNEL, 'invalidate');

    // After updateSettings cleared L1 & Redis, next request fetches fresh maintenance=true
    (redis.get as jest.MockedFunction<any>).mockResolvedValueOnce(null);
    ((prisma as any).platformSetting.findUnique as jest.MockedFunction<any>).mockResolvedValueOnce(updated);

    const nextAfterUpdate = jest.fn();
    await maintenanceModeMiddleware(
      { originalUrl: '/api/v1/gamingCenters', url: '/api/v1/gamingCenters' } as any,
      {} as any,
      nextAfterUpdate
    );
    expect(nextAfterUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 503, code: 'MAINTENANCE_MODE' })
    );
  });
});
