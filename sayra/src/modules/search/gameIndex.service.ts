import { GameStationType, GamingCenterVerificationStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import {
  bumpGameIndexVersion,
  getGameIndexVersion,
  withPublicCache,
} from '../../common/utils/publicCache';
import { formatPaginatedResult, getPaginationParams } from '../../common/utils/pagination';
import { toPublicStationType } from '../../common/utils/station-type';
import {
  normalizeSearchText,
  scoreTextMatch,
  toCompactSearchKey,
} from '../../common/utils/searchText';
import {
  IndexedCatalogGame,
  ResolvedGameMatch,
  SearchCatalogGameItemDto,
} from './search.types';

let localMemoryIndex: { version: number; expiresAt: number; games: IndexedCatalogGame[] } | null = null;
const LOCAL_INDEX_TTL_MS = 60_000;

export function invalidateGameSearchIndexCache(): void {
  localMemoryIndex = null;
  bumpGameIndexVersion();
}

async function fetchActiveGamesFromDb(): Promise<IndexedCatalogGame[]> {
  if (typeof prisma.gameCatalog?.findMany !== 'function') {
    return [];
  }

  const hasAliases = typeof prisma.gameAlias?.findMany === 'function';
  const rows = await prisma.gameCatalog.findMany({
    where: { isActive: true },
    ...(hasAliases
      ? {
        include: {
          aliases: {
            select: { alias: true, normalized: true, locale: true },
          },
        },
      }
      : {}),
    orderBy: [{ popularityScore: 'desc' }, { createdAt: 'desc' }],
  });

  return (rows || []).map((row) => {
    const rawAliases = (row as { aliases?: Array<{ alias: string; normalized: string; locale: string | null }> }).aliases;
    const aliases = Array.isArray(rawAliases)
      ? rawAliases.map((a) => ({
        alias: a.alias,
        normalized: a.normalized || normalizeSearchText(a.alias),
        locale: a.locale ?? null,
      }))
      : [];

    return {
      id: row.id,
      slug: (row as { slug?: string | null }).slug ?? null,
      title: row.title,
      titleFa: (row as { titleFa?: string | null }).titleFa ?? null,
      titleEn: (row as { titleEn?: string | null }).titleEn ?? null,
      category: (row as { category?: string | null }).category ?? null,
      genre: row.genre ?? null,
      description: row.description ?? null,
      coverImageUrl: row.coverImageUrl,
      supportedPlatforms: Array.isArray(row.supportedPlatforms) ? row.supportedPlatforms : [],
      supportsOnline: Boolean(row.supportsOnline),
      popularityScore: Number((row as { popularityScore?: number }).popularityScore ?? 0),
      normalizedKey: (row as { normalizedKey?: string | null }).normalizedKey ?? toCompactSearchKey(row.title),
      aliases,
    };
  });
}

export async function getActiveGameIndex(): Promise<IndexedCatalogGame[]> {
  const version = getGameIndexVersion();
  const isTest = process.env.NODE_ENV === 'test';

  if (
    !isTest &&
    localMemoryIndex &&
    localMemoryIndex.version === version &&
    localMemoryIndex.expiresAt > Date.now()
  ) {
    return localMemoryIndex.games;
  }

  const cacheKey = `public:search:game-index:v${version}`;
  const games = await withPublicCache(cacheKey, 300, fetchActiveGamesFromDb);

  if (!isTest) {
    localMemoryIndex = {
      version,
      expiresAt: Date.now() + LOCAL_INDEX_TTL_MS,
      games,
    };
  }

  return games;
}

export function scoreIndexedGameMatch(
  query: string,
  game: IndexedCatalogGame
): { score: number; matchType: ResolvedGameMatch['matchType']; matchedTerm: string } {
  const candidates: Array<{ term: string; boost: number }> = [
    { term: game.title, boost: 2 },
    ...(game.titleEn ? [{ term: game.titleEn, boost: 2 }] : []),
    ...(game.titleFa ? [{ term: game.titleFa, boost: 2 }] : []),
    ...(game.slug ? [{ term: game.slug.replace(/-/g, ' '), boost: 1 }] : []),
    ...game.aliases.map((a) => ({ term: a.alias, boost: 0 })),
  ];

  let bestScore = 0;
  let bestType: ResolvedGameMatch['matchType'] = 'none';
  let bestTerm = game.title;

  for (const cand of candidates) {
    if (!cand.term) continue;
    const res = scoreTextMatch(query, cand.term);
    if (res.matched) {
      const adjusted = Math.min(100, res.score + (res.score === 100 ? 0 : cand.boost));
      if (adjusted > bestScore) {
        bestScore = adjusted;
        bestType = res.matchType;
        bestTerm = cand.term;
      }
    }
  }

  return { score: bestScore, matchType: bestType, matchedTerm: bestTerm };
}

/**
 * Resolves catalog games matching a free-text query, explicit IDs, or slug
 * with Persian/Arabic normalization, aliases, and typo tolerance.
 */
export async function resolveMatchingGames(
  query?: string,
  options?: {
    gameIds?: string[];
    gameSlug?: string;
    platform?: GameStationType;
    category?: string;
    minScore?: number;
  }
): Promise<ResolvedGameMatch[]> {
  const games = await getActiveGameIndex();
  const minScore = options?.minScore ?? 55;

  let pool = games;
  if (options?.platform) {
    pool = pool.filter(
      (g) => g.supportedPlatforms.length === 0 || g.supportedPlatforms.includes(options.platform!)
    );
  }
  if (options?.category) {
    pool = pool.filter((g) => g.category === options.category);
  }

  const results: ResolvedGameMatch[] = [];
  const seenIds = new Set<string>();

  if (options?.gameIds && options.gameIds.length > 0) {
    const idSet = new Set(options.gameIds);
    for (const g of pool) {
      if (idSet.has(g.id)) {
        seenIds.add(g.id);
        results.push({
          game: g,
          score: 100,
          matchType: 'exact',
          matchedTerm: g.title,
        });
      }
    }
  }

  if (options?.gameSlug) {
    const cleanSlug = normalizeSearchText(options.gameSlug);
    for (const g of pool) {
      if (seenIds.has(g.id)) continue;
      if (
        (g.slug && normalizeSearchText(g.slug) === cleanSlug) ||
        g.id === options.gameSlug
      ) {
        seenIds.add(g.id);
        results.push({
          game: g,
          score: 100,
          matchType: 'exact',
          matchedTerm: g.slug || g.title,
        });
      }
    }
  }

  if (query && query.trim()) {
    const cleanQuery = query.trim();
    for (const g of pool) {
      if (seenIds.has(g.id)) continue;

      // Also match direct ID or slug if passed into `game=`
      if (g.id === cleanQuery || (g.slug && g.slug.toLowerCase() === cleanQuery.toLowerCase())) {
        seenIds.add(g.id);
        results.push({
          game: g,
          score: 100,
          matchType: 'exact',
          matchedTerm: cleanQuery,
        });
        continue;
      }

      const match = scoreIndexedGameMatch(cleanQuery, g);
      if (match.score >= minScore) {
        seenIds.add(g.id);
        results.push({
          game: g,
          score: match.score,
          matchType: match.matchType,
          matchedTerm: match.matchedTerm,
        });
      }
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.game.popularityScore !== a.game.popularityScore) {
      return b.game.popularityScore - a.game.popularityScore;
    }
    return a.game.title.localeCompare(b.game.title);
  });

  return results;
}

/**
 * Counts how many active, approved gaming centers offer each game AND have >= 1 active compatible station.
 */
export async function computeActiveCenterCountsByGame(
  gameIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (gameIds.length === 0) return counts;
  if (typeof prisma.gamingCenter?.findMany !== 'function') {
    return counts;
  }

  const index = await getActiveGameIndex();
  const gameById = new Map(index.map((g) => [g.id, g]));

  const centers = await prisma.gamingCenter.findMany({
    where: {
      isActive: true,
      verificationStatus: GamingCenterVerificationStatus.APPROVED,
      OR: [
        { centerGames: { some: { gameCatalogId: { in: gameIds } } } },
        { stations: { some: { isActive: true, stationGames: { some: { gameCatalogId: { in: gameIds }, isActive: true } } } } },
      ],
    },
    select: {
      id: true,
      stations: {
        where: { isActive: true },
        select: {
          id: true,
          stationType: true,
          stationGames: {
            where: { gameCatalogId: { in: gameIds } },
            select: { gameCatalogId: true, isActive: true },
          },
        },
      },
      centerGames: {
        where: { gameCatalogId: { in: gameIds } },
        select: { gameCatalogId: true, platforms: true },
      },
    },
  });

  for (const center of centers || []) {
    const stations = (center as { stations?: Array<{ id: string; stationType: GameStationType; stationGames?: Array<{ gameCatalogId: string; isActive: boolean }> }> }).stations || [];
    const centerGames = (center as { centerGames?: Array<{ gameCatalogId: string; platforms: GameStationType[] }> }).centerGames || [];

    for (const gid of gameIds) {
      const cat = gameById.get(gid);
      if (!cat) continue;
      const cg = centerGames.find((c) => c.gameCatalogId === gid);
      const allowedPlatforms =
        cg && Array.isArray(cg.platforms) && cg.platforms.length > 0
          ? cg.platforms
          : cat.supportedPlatforms;

      const explicitActive = stations.some((s) =>
        (s.stationGames || []).some((sg) => sg.gameCatalogId === gid && sg.isActive)
      );
      if (explicitActive) {
        counts.set(gid, (counts.get(gid) ?? 0) + 1);
        continue;
      }

      if (cg) {
        const hasCompatibleStation = stations.some((s) => {
          const explicitlyDisabled = (s.stationGames || []).some(
            (sg) => sg.gameCatalogId === gid && sg.isActive === false
          );
          if (explicitlyDisabled) return false;
          return allowedPlatforms.length === 0 || allowedPlatforms.includes(s.stationType);
        });
        if (hasCompatibleStation) {
          counts.set(gid, (counts.get(gid) ?? 0) + 1);
        }
      }
    }
  }

  return counts;
}

/**
 * Public catalog game search with alias matching, fuzzy tolerance, and real center counts.
 */
export async function searchCatalogGames(params: {
  q?: string;
  platform?: GameStationType;
  category?: string;
  supportsOnline?: boolean;
  page: number;
  limit: number;
}) {
  const allGames = await getActiveGameIndex();
  let filtered = allGames;

  if (params.platform) {
    filtered = filtered.filter(
      (g) => g.supportedPlatforms.length === 0 || g.supportedPlatforms.includes(params.platform!)
    );
  }
  if (params.category) {
    filtered = filtered.filter((g) => g.category === params.category);
  }
  if (params.supportsOnline !== undefined) {
    filtered = filtered.filter((g) => g.supportsOnline === params.supportsOnline);
  }

  const scored: Array<{ game: IndexedCatalogGame; score: number }> = [];
  if (params.q && params.q.trim()) {
    for (const g of filtered) {
      const m = scoreIndexedGameMatch(params.q.trim(), g);
      if (m.score >= 55) {
        scored.push({ game: g, score: m.score });
      }
    }
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.game.popularityScore - a.game.popularityScore;
    });
  } else {
    for (const g of filtered) {
      scored.push({ game: g, score: 100 });
    }
    scored.sort((a, b) => {
      if (b.game.popularityScore !== a.game.popularityScore) {
        return b.game.popularityScore - a.game.popularityScore;
      }
      return a.game.title.localeCompare(b.game.title);
    });
  }

  const total = scored.length;
  const { skip, take } = getPaginationParams(params.page, params.limit);
  const pageSlice = scored.slice(skip, skip + take);
  const countMap = await computeActiveCenterCountsByGame(pageSlice.map((s) => s.game.id));

  const items: SearchCatalogGameItemDto[] = pageSlice.map(({ game, score }) => ({
    id: game.id,
    slug: game.slug,
    title: game.title,
    titleFa: game.titleFa,
    titleEn: game.titleEn,
    category: game.category,
    genre: game.genre,
    description: game.description,
    coverImageUrl: game.coverImageUrl,
    supportedPlatforms: game.supportedPlatforms.map((p) => toPublicStationType(p)),
    supportsOnline: game.supportsOnline,
    popularityScore: game.popularityScore,
    aliases: game.aliases.map((a) => a.alias),
    centerCount: countMap.get(game.id) ?? 0,
    matchScore: score,
  }));

  return formatPaginatedResult(items, total, params.page, params.limit);
}
