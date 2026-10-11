import { describe, it, expect, jest } from '@jest/globals';
import { IdempotencyRepo } from '../../../../src/common/repositories/idempotency.repo';
import redis from '../../../../src/config/redis';
import { IdempotencyStatus } from '../../../../src/types/idempotency';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../../src/config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  },
}));

describe('IdempotencyRepo', () => {
  const scope = 'test-scope';
  const key = 'test-key';
  const redisKey = `idempotency:${scope}:${key}`;

  it('findKey should return record if found', async () => {
    const mockRecord = {
      id: '1',
      key,
      scope,
      status: IdempotencyStatus.IN_PROGRESS,
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    (redis.get /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue(JSON.stringify(mockRecord));

    const result = await IdempotencyRepo.findKey(scope, key);
    expect(result?.key).toBe(key);
    expect(redis.get).toHaveBeenCalledWith(redisKey);
  });

  it('createKey should set value in redis', async () => {
    (redis.set /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue('OK');
    const data = {
      key,
      scope,
      requestHash: 'hash',
      status: IdempotencyStatus.IN_PROGRESS,
      expiresAt: new Date(Date.now() + 10000),
    };

    await IdempotencyRepo.createKey(data);
    expect(redis.set).toHaveBeenCalled();
  });

  it('updateKey should update existing record', async () => {
    const existing = {
      key,
      scope,
      expiresAt: new Date(Date.now() + 10000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    (redis.get /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue(JSON.stringify(existing));
    (redis.set /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue('OK');

    await IdempotencyRepo.updateKey(scope, key, { status: IdempotencyStatus.COMPLETED });
    expect(redis.set).toHaveBeenCalled();
  });

  it('deleteKey should remove from redis', async () => {
    await IdempotencyRepo.deleteKey(scope, key);
    expect(redis.del).toHaveBeenCalledWith(redisKey);
  });

  it('clearAll should remove all keys', async () => {
    (redis.keys /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue(['k1', 'k2']);
    await IdempotencyRepo.clearAll();
    expect(redis.del).toHaveBeenCalled();
  });
});
