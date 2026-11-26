import redis from '../../config/redis';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { normalizeShortCode } from './shortCode';
import { CachedShortLinkPayload } from './shortLinks.types';

const CODE_CACHE_PREFIX = 'shortlink:code:';
const NEGATIVE_SENTINEL = '__NOT_FOUND__';
const HOT_CACHE_TTL_SECONDS = 300;
const NEGATIVE_CACHE_TTL_SECONDS = 30;

const inFlightLookups = new Map<string, Promise<CachedShortLinkPayload | null>>();

// Bounded in-memory fallbacks for offline/test environments without Redis atomic INCR/SET NX
const localSignalExpiryMap = new Map<string, number>();
const localBurstCounters = new Map<string, { count: number; expiresAt: number }>();

function pruneMapIfLarge(now: number): void {
  if (localSignalExpiryMap.size > 5000) {
    for (const [k, exp] of localSignalExpiryMap.entries()) {
      if (exp <= now) localSignalExpiryMap.delete(k);
      if (localSignalExpiryMap.size <= 3500) break;
    }
  }
  if (localBurstCounters.size > 5000) {
    for (const [k, entry] of localBurstCounters.entries()) {
      if (entry.expiresAt <= now) localBurstCounters.delete(k);
      if (localBurstCounters.size <= 3500) break;
    }
  }
}

export function resetInMemoryClickSignalState(): void {
  localSignalExpiryMap.clear();
  localBurstCounters.clear();
}

export async function getCachedShortLinkByCode(
  normalizedCode: string,
  loader: () => Promise<CachedShortLinkPayload | null>
): Promise<CachedShortLinkPayload | null> {
  const key = `${CODE_CACHE_PREFIX}${normalizeShortCode(normalizedCode)}`;

  try {
    if (typeof redis?.get === 'function') {
      const cached = await redis.get(key);
      if (cached === NEGATIVE_SENTINEL) {
        return null;
      }
      if (cached) {
        return JSON.parse(cached) as CachedShortLinkPayload;
      }
    }
  } catch (err) {
    logger.warn({ msg: 'ShortLink Redis read error, falling back to DB', err: err instanceof Error ? err.message : String(err) });
  }

  const existing = inFlightLookups.get(key);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const fresh = await loader();
      try {
        if (typeof redis?.set === 'function') {
          if (fresh) {
            await redis.set(key, JSON.stringify(fresh), 'EX', HOT_CACHE_TTL_SECONDS);
          } else {
            await redis.set(key, NEGATIVE_SENTINEL, 'EX', NEGATIVE_CACHE_TTL_SECONDS);
          }
        }
      } catch {
        // Ignore Redis write error on redirect path
      }
      return fresh;
    } finally {
      inFlightLookups.delete(key);
    }
  })();

  inFlightLookups.set(key, promise);
  return promise;
}

export async function invalidateShortLinkCache(codeOrNormalized: string): Promise<void> {
  const key = `${CODE_CACHE_PREFIX}${normalizeShortCode(codeOrNormalized)}`;
  try {
    if (typeof redis?.del === 'function') {
      await redis.del(key);
    }
  } catch {
    // Ignore Redis delete failure
  }
}

export async function checkAndReserveMaxClickQuota(
  shortLinkId: string,
  maxClicks: number,
  dbTotalClicks: number
): Promise<boolean> {
  if (dbTotalClicks >= maxClicks) {
    return false;
  }

  const quotaKey = `shortlink:maxclicks:${shortLinkId}`;
  try {
    if (typeof redis?.incr === 'function' && typeof redis?.expire === 'function') {
      if (typeof redis?.set === 'function') {
        await redis.set(quotaKey, String(dbTotalClicks), 'EX', HOT_CACHE_TTL_SECONDS, 'NX');
      }
      const nextCount = await redis.incr(quotaKey);
      await redis.expire(quotaKey, HOT_CACHE_TTL_SECONDS);
      return nextCount <= maxClicks;
    }

    if (typeof redis?.get === 'function' && typeof redis?.set === 'function') {
      const raw = await redis.get(quotaKey);
      const parsed = raw !== null ? Number(raw) : 0;
      const current = Number.isFinite(parsed) ? Math.max(dbTotalClicks, parsed) : dbTotalClicks;
      if (current >= maxClicks) {
        return false;
      }
      await redis.set(quotaKey, String(current + 1), 'EX', HOT_CACHE_TTL_SECONDS);
      return true;
    }
  } catch {
    // Fall back to DB totalClicks check already performed above
  }

  return true;
}

export interface ClickSignalsResult {
  isUniqueVisitor: boolean;
  isDuplicate: boolean;
  isBurstSuspicious: boolean;
}

/**
 * Tracks duplicate window, daily unique visitor approximation, and burst abuse signals
 * atomically via Redis when available, falling back to bounded in-memory tracking cleanly.
 */
export async function checkAndTrackClickSignals(
  shortLinkId: string,
  visitorHash: string,
  ipBucketHash: string,
  utcDate: string
): Promise<ClickSignalsResult> {
  const dedupSeconds = env.SHORT_LINK_DEDUP_WINDOW_SECONDS || 300;
  const maxPerMinute = env.SHORT_LINK_BURST_MAX_CLICKS_PER_MINUTE || 20;

  const uniqueKey = `shortlink:uv:${shortLinkId}:${utcDate}:${visitorHash}`;
  const dedupKey = `shortlink:dup:${shortLinkId}:${visitorHash}`;
  const burstKey = `shortlink:burst:${shortLinkId}:${ipBucketHash}`;

  const canUseRedisAtomic =
    process.env.NODE_ENV !== 'test' &&
    typeof redis?.set === 'function' &&
    typeof redis?.incr === 'function' &&
    typeof redis?.expire === 'function';

  if (canUseRedisAtomic) {
    try {
      const [uvSet, dupSet, burstCount] = await Promise.all([
        redis.set(uniqueKey, '1', 'EX', 86400, 'NX'),
        redis.set(dedupKey, '1', 'EX', dedupSeconds, 'NX'),
        redis.incr(burstKey),
      ]);

      if (burstCount === 1) {
        await redis.expire(burstKey, 60);
      }

      return {
        isUniqueVisitor: uvSet === 'OK',
        isDuplicate: dupSet === null,
        isBurstSuspicious: burstCount > maxPerMinute,
      };
    } catch {
      // Fallback to in-memory tracking below
    }
  }

  const now = Date.now();
  pruneMapIfLarge(now);

  const uvExp = localSignalExpiryMap.get(uniqueKey);
  const isUniqueVisitor = !uvExp || uvExp <= now;
  if (isUniqueVisitor) {
    localSignalExpiryMap.set(uniqueKey, now + 86400_000);
  }

  const dupExp = localSignalExpiryMap.get(dedupKey);
  const isDuplicate = Boolean(dupExp && dupExp > now);
  if (!isDuplicate) {
    localSignalExpiryMap.set(dedupKey, now + dedupSeconds * 1000);
  }

  const burstEntry = localBurstCounters.get(burstKey);
  let nextCount = 1;
  if (burstEntry && burstEntry.expiresAt > now) {
    nextCount = burstEntry.count + 1;
    burstEntry.count = nextCount;
  } else {
    localBurstCounters.set(burstKey, { count: 1, expiresAt: now + 60_000 });
  }

  return {
    isUniqueVisitor,
    isDuplicate,
    isBurstSuspicious: nextCount > maxPerMinute,
  };
}
