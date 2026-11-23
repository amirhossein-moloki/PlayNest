import { prisma } from '../../config/prisma';
import redis from '../../config/redis';

export interface CachedTenant {
  id: string;
  slug: string;
  name?: string;
  isActive: boolean;
  verificationStatus?: string | null;
}

export const TENANT_CACHE_TTL_SECONDS = 60;
const TENANT_CACHE_TIMEOUT_MS = 150;

export function getTenantIdCacheKey(id: string): string {
  return `tenant:id:${id}`;
}

export function getTenantSlugCacheKey(slug: string): string {
  return `tenant:slug:${slug}`;
}

function isTenantCacheActive(): boolean {
  const envEnabled = process.env.NODE_ENV !== 'test' || process.env.ENABLE_TENANT_CACHE_IN_TEST === 'true';
  if (!envEnabled) return false;
  return redis?.status === 'ready' || process.env.ENABLE_TENANT_CACHE_IN_TEST === 'true';
}

async function readRedisWithTimeout(fn: () => Promise<Array<string | null>>): Promise<Array<string | null>> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<Array<string | null>>((resolve) => {
        timeoutHandle = setTimeout(() => resolve([]), TENANT_CACHE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return [];
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function cacheTenant(tenant: CachedTenant): Promise<void> {
  if (!isTenantCacheActive() || typeof redis?.set !== 'function') {
    return;
  }

  const payload = JSON.stringify({
    id: tenant.id,
    slug: tenant.slug,
    ...(tenant.name !== undefined ? { name: tenant.name } : {}),
    isActive: tenant.isActive,
    ...(tenant.verificationStatus !== undefined ? { verificationStatus: tenant.verificationStatus } : {}),
  });

  try {
    await Promise.allSettled([
      redis.set(getTenantIdCacheKey(tenant.id), payload, 'EX', TENANT_CACHE_TTL_SECONDS),
      ...(tenant.slug
        ? [redis.set(getTenantSlugCacheKey(tenant.slug), payload, 'EX', TENANT_CACHE_TTL_SECONDS)]
        : []),
    ]);
  } catch {
    // Best-effort cache write
  }
}

export async function resolveTenantBySlug(slug: string): Promise<CachedTenant | null> {
  if (isTenantCacheActive() && typeof redis?.get === 'function') {
    const [raw] = await readRedisWithTimeout(async () => [await redis.get(getTenantSlugCacheKey(slug))]);
    if (typeof raw === 'string' && raw.length > 0) {
      try {
        const parsed = JSON.parse(raw) as CachedTenant;
        if (parsed && parsed.id && parsed.slug) {
          return parsed;
        }
      } catch {
        // Fall back to DB lookup on corrupt payload
      }
    }
  }

  const gamingCenter = await prisma.gamingCenter.findUnique({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      verificationStatus: true,
    },
  });

  if (gamingCenter) {
    void cacheTenant(gamingCenter);
  }

  return gamingCenter;
}

export async function resolveTenantByIdOrSlug(identifier: string): Promise<CachedTenant | null> {
  if (isTenantCacheActive()) {
    const idKey = getTenantIdCacheKey(identifier);
    const slugKey = getTenantSlugCacheKey(identifier);
    const [idRaw, slugRaw] = await readRedisWithTimeout(async () => {
      if (typeof redis?.mget === 'function') {
        return redis.mget(idKey, slugKey);
      }
      if (typeof redis?.get === 'function') {
        return Promise.all([redis.get(idKey), redis.get(slugKey)]);
      }
      return [];
    });

    if (typeof idRaw === 'string' && idRaw.length > 0) {
      try {
        const parsed = JSON.parse(idRaw) as CachedTenant;
        if (parsed && parsed.id) {
          return parsed;
        }
      } catch {
        // Fall through
      }
    }

    if (typeof slugRaw === 'string' && slugRaw.length > 0) {
      try {
        const parsed = JSON.parse(slugRaw) as CachedTenant;
        if (parsed && parsed.id && parsed.isActive !== false) {
          return parsed;
        }
      } catch {
        // Fall through
      }
    }
  }

  let gamingCenter = await prisma.gamingCenter.findUnique({
    where: { id: identifier },
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      verificationStatus: true,
    },
  });

  if (!gamingCenter) {
    gamingCenter = await prisma.gamingCenter.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        verificationStatus: true,
      },
    });
  }

  if (gamingCenter) {
    void cacheTenant(gamingCenter);
  }

  return gamingCenter;
}

export async function invalidateTenantCache(
  gamingCenterId?: string | null,
  ...slugs: Array<string | null | undefined>
): Promise<void> {
  if (!isTenantCacheActive() || typeof redis?.del !== 'function') {
    return;
  }

  const keysToDelete = new Set<string>();
  if (gamingCenterId) {
    keysToDelete.add(getTenantIdCacheKey(gamingCenterId));
  }
  for (const s of slugs) {
    if (s) {
      keysToDelete.add(getTenantSlugCacheKey(s));
    }
  }

  // If caller only passed ID (e.g. verification approval), discover any cached slug first so both keys are invalidated.
  if (gamingCenterId && slugs.every((s) => !s) && typeof redis.get === 'function') {
    try {
      const cachedRaw = await redis.get(getTenantIdCacheKey(gamingCenterId));
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw) as CachedTenant;
        if (parsed?.slug) {
          keysToDelete.add(getTenantSlugCacheKey(parsed.slug));
        }
      }
    } catch {
      // Best-effort lookup
    }
  }

  if (keysToDelete.size === 0) {
    return;
  }

  try {
    await redis.del(...Array.from(keysToDelete));
  } catch {
    // Best-effort invalidation
  }
}
