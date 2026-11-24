import { Response } from 'express';
import { redis } from '../../config/redis';

const CACHE_TIMEOUT_MS = 150;
const inFlight = new Map<string, Promise<unknown>>();
let gameIndexVersion = 1;

export function getGameIndexVersion(): number {
  return gameIndexVersion;
}

export function bumpGameIndexVersion(): void {
  gameIndexVersion += 1;
}

function isCacheActive(): boolean {
  return process.env.NODE_ENV !== 'test' && redis?.status === 'ready';
}

export function buildSortedCacheKey(prefix: string, params?: Record<string, unknown>): string {
  if (!params) return prefix;
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return prefix;
  return `${prefix}:${JSON.stringify(entries)}`;
}

/**
 * Sets standard HTTP Cache-Control headers on read-only public API endpoints
 * so Cloudflare, CDNs, and Vercel ISR can cache origin responses safely.
 */
export function setPublicCacheHeaders(
  res: Response,
  maxAgeSec = 60,
  sMaxAgeSec = 120,
  swrSec = 300
): void {
  res.set(
    'Cache-Control',
    `public, max-age=${maxAgeSec}, s-maxage=${sMaxAgeSec}, stale-while-revalidate=${swrSec}`
  );
}

/**
 * Fail-open Redis JSON read-through cache with in-process singleflight coalescing
 * to prevent duplicate concurrent DB queries on cache misses.
 * Bypassed during automated tests or when Redis is not ready.
 */
export async function withPublicCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!isCacheActive()) {
    return fetcher();
  }

  let timeoutHandle: NodeJS.Timeout | undefined;
  try {
    const cached = await Promise.race([
      redis.get(key),
      new Promise<null>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(null), CACHE_TIMEOUT_MS);
      }),
    ]);
    if (typeof cached === 'string' && cached.length > 0) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Fail-open to live query
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }

  const existingFlight = inFlight.get(key) as Promise<T> | undefined;
  if (existingFlight) {
    return existingFlight;
  }

  const flightPromise = (async () => {
    const fresh = await fetcher();
    try {
      if (isCacheActive() && fresh !== undefined && fresh !== null) {
        void redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds).catch(() => undefined);
      }
    } catch {
      // Ignore cache write errors
    }
    return fresh;
  })();

  inFlight.set(key, flightPromise);
  try {
    return await flightPromise;
  } finally {
    inFlight.delete(key);
  }
}

/**
 * Non-blocking cursor-based invalidation of cached public keys matching prefix.
 */
export async function invalidatePublicCacheByPrefix(prefix: string): Promise<void> {
  if (!isCacheActive() || typeof redis.scan !== 'function') {
    return;
  }

  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', '100');
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    // Best-effort invalidation
  }
}

/**
 * Invalidates all public discovery, catalog, game-index, and search caches across Sayra.
 */
export async function invalidateAllPublicDiscoveryCaches(): Promise<void> {
  bumpGameIndexVersion();
  await Promise.allSettled([
    invalidatePublicCacheByPrefix('public:gc:'),
    invalidatePublicCacheByPrefix('public:gamecenters:'),
    invalidatePublicCacheByPrefix('public:search:'),
    invalidatePublicCacheByPrefix('public:catalog:'),
  ]);
}
