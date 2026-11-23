import { Response } from 'express';
import { redis } from '../../config/redis';

const CACHE_TIMEOUT_MS = 150;

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
 * Fail-open Redis JSON read-through cache for public read endpoints.
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

  try {
    const cached = await Promise.race([
      redis.get(key),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), CACHE_TIMEOUT_MS)),
    ]);
    if (typeof cached === 'string' && cached.length > 0) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Fail-open to live query
  }

  const fresh = await fetcher();

  try {
    if (isCacheActive() && fresh !== undefined && fresh !== null) {
      void redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds).catch(() => undefined);
    }
  } catch {
    // Ignore cache write errors
  }

  return fresh;
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
