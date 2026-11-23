/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest } from '@jest/globals';
import { withDistributedLock, RedisLockClient } from '../../../../src/common/utils/distributedLock';

function createMockRedisStore() {
  const store = new Map<string, string>();
  const client: RedisLockClient = {
    status: 'ready',
    set: jest.fn(async (...args: unknown[]) => {
      const [key, value, , , nxFlag] = args as [string, string, string, number, string];
      if (nxFlag === 'NX' && store.has(key)) {
        return null;
      }
      store.set(key, value);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    eval: jest.fn(async (_lua: string, _numKeys: number, key: string, token: string) => {
      if (store.get(key) === token) {
        store.delete(key);
        return 1;
      }
      return 0;
    }),
  };
  return { store, client };
}

describe('distributedLock (AMI-38)', () => {
  it('allows only one concurrent holder when two workers contend for the same lock', async () => {
    const { store, client } = createMockRedisStore();
    let executions = 0;

    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = withDistributedLock(
      'reservation-expiry',
      10000,
      async () => {
        executions++;
        await firstGate;
        return 'first-done';
      },
      { redisClient: client }
    );

    await new Promise((r) => setTimeout(r, 15));

    const second = await withDistributedLock(
      'reservation-expiry',
      10000,
      async () => {
        executions++;
        return 'second-done';
      },
      { redisClient: client }
    );

    expect(second.acquired).toBe(false);
    expect(second.result).toBeUndefined();
    expect(executions).toBe(1);

    releaseFirst();
    const firstResult = await first;
    expect(firstResult.acquired).toBe(true);
    expect(firstResult.result).toBe('first-done');
    expect(store.size).toBe(0);

    const third = await withDistributedLock(
      'reservation-expiry',
      10000,
      async () => 'reacquired',
      { redisClient: client }
    );
    expect(third).toEqual({ acquired: true, result: 'reacquired' });
  });

  it('releases the lock safely even if the guarded task throws', async () => {
    const { store, client } = createMockRedisStore();

    await expect(
      withDistributedLock(
        'waitlist-expiry',
        5000,
        async () => {
          throw new Error('boom');
        },
        { redisClient: client }
      )
    ).rejects.toThrow('boom');

    expect(store.size).toBe(0);
    expect(client.eval).toHaveBeenCalledTimes(1);
  });

  it('fails closed when Redis client is not ready unless fallback is enabled', async () => {
    const { client } = createMockRedisStore();
    client.status = 'reconnecting';
    const task = jest.fn(async () => 'ran');

    const closed = await withDistributedLock('reminders', 5000, task, { redisClient: client });
    expect(closed.acquired).toBe(false);
    expect(task).not.toHaveBeenCalled();

    const opened = await withDistributedLock('reminders', 5000, task, {
      redisClient: client,
      fallbackWhenRedisUnavailable: true,
    });
    expect(opened).toEqual({ acquired: true, result: 'ran' });
    expect(task).toHaveBeenCalledTimes(1);
  });
});
