import { formatInTimeZone } from 'date-fns-tz';
import { prisma } from '../../config/prisma';
import { withPublicCache, invalidatePublicCacheByPrefix } from '../../common/utils/publicCache';

export const ANALYTICS_LIVE_TTL_SECONDS = 60;
export const ANALYTICS_HISTORICAL_TTL_SECONDS = 300;
export const ANALYTICS_TZ_CACHE_TTL_SECONDS = 300;

/**
 * Uses a longer Redis cache TTL (300s) for purely historical windows that ended
 * before today in the gaming center's timezone, and 60s for active/today windows.
 */
export function computeAnalyticsTtlSeconds(dayEnd: Date, timeZone: string, now = new Date()): number {
  try {
    const endDateStr = formatInTimeZone(dayEnd, timeZone, 'yyyy-MM-dd');
    const todayStr = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
    if (endDateStr < todayStr) {
      return ANALYTICS_HISTORICAL_TTL_SECONDS;
    }
  } catch {
    // Fall back to shorter live TTL if timezone formatting fails
  }
  return ANALYTICS_LIVE_TTL_SECONDS;
}

export async function getCachedCenterTimezone(gamingCenterId: string): Promise<string> {
  return withPublicCache(`analytics:tz:${gamingCenterId}`, ANALYTICS_TZ_CACHE_TTL_SECONDS, async () => {
    const settings = await prisma.settings.findUnique({
      where: { gamingCenterId },
      select: { timeZone: true },
    });
    return settings?.timeZone || 'UTC';
  });
}

export async function invalidateAnalyticsTimezoneCache(gamingCenterId: string): Promise<void> {
  await invalidatePublicCacheByPrefix(`analytics:tz:${gamingCenterId}`);
}

export async function withAnalyticsCache<
  T extends { period?: { startDate?: Date | string; endDate?: Date | string } },
>(
  reportKey: string,
  gamingCenterId: string,
  dayStart: Date,
  dayEnd: Date,
  timeZone: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const ttlSeconds = computeAnalyticsTtlSeconds(dayEnd, timeZone);
  const cacheKey = `analytics:${reportKey}:${gamingCenterId}:${dayStart.toISOString()}:${dayEnd.toISOString()}`;
  const result = await withPublicCache<T>(cacheKey, ttlSeconds, fetcher);

  if (result && typeof result === 'object' && result.period) {
    if (typeof result.period.startDate === 'string') {
      result.period.startDate = new Date(result.period.startDate);
    }
    if (typeof result.period.endDate === 'string') {
      result.period.endDate = new Date(result.period.endDate);
    }
  }

  return result;
}
