import crypto from 'crypto';
import redis from '../../config/redis';
import logger from '../../config/logger';

export interface RedisLockClient {
  status?: string;
  set: (...args: unknown[]) => Promise<unknown>;
  get?: (key: string) => Promise<string | null>;
  del?: (key: string) => Promise<unknown>;
  eval?: (script: string, numkeys: number, ...args: string[]) => Promise<unknown>;
}

export interface DistributedLockOptions {
  redisClient?: RedisLockClient;
  fallbackWhenRedisUnavailable?: boolean;
}

export interface DistributedLockResult<T> {
  acquired: boolean;
  result?: T;
}

const RELEASE_LOCK_LUA =
  'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';

async function releaseLockSafely(client: RedisLockClient, lockKey: string, token: string): Promise<void> {
  try {
    if (typeof client.eval === 'function') {
      await client.eval(RELEASE_LOCK_LUA, 1, lockKey, token);
      return;
    }

    if (typeof client.get === 'function' && typeof client.del === 'function') {
      const current = await client.get(lockKey);
      if (current === token) {
        await client.del(lockKey);
      }
    }
  } catch (err) {
    logger.warn(
      { lockKey, err: err instanceof Error ? err.message : String(err) },
      'Failed to release distributed worker lock'
    );
  }
}

/**
 * Acquires a short-lived Redis leader lock (`SET NX PX`) before executing a
 * periodic background worker tick so multiple worker processes cannot double-process
 * the same polling window concurrently.
 */
export async function withDistributedLock<T>(
  lockName: string,
  ttlMs: number,
  fn: () => Promise<T>,
  options?: DistributedLockOptions
): Promise<DistributedLockResult<T>> {
  const bypassInTest =
    process.env.NODE_ENV === 'test' &&
    process.env.ENABLE_DISTRIBUTED_LOCK_IN_TEST !== 'true' &&
    !options?.redisClient;

  if (bypassInTest) {
    return { acquired: true, result: await fn() };
  }

  const client = (options?.redisClient ?? redis) as RedisLockClient;
  const fallback = options?.fallbackWhenRedisUnavailable ?? false;

  if (!client || typeof client.set !== 'function' || (client.status && client.status !== 'ready')) {
    if (fallback) {
      return { acquired: true, result: await fn() };
    }
    logger.warn({ lockName, status: client?.status }, 'Skipping worker tick because Redis lock store is not ready');
    return { acquired: false };
  }

  const lockKey = `lock:worker:${lockName}`;
  const token = `${process.pid}:${crypto.randomUUID()}`;
  const effectiveTtlMs = Math.max(1000, Math.floor(ttlMs));

  let acquired = false;
  try {
    const res = await client.set(lockKey, token, 'PX', effectiveTtlMs, 'NX');
    acquired = res === 'OK';
  } catch (err) {
    logger.warn(
      { lockKey, err: err instanceof Error ? err.message : String(err) },
      'Error acquiring distributed worker lock'
    );
    if (fallback) {
      return { acquired: true, result: await fn() };
    }
    return { acquired: false };
  }

  if (!acquired) {
    return { acquired: false };
  }

  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    await releaseLockSafely(client, lockKey, token);
  }
}
