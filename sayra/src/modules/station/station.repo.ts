import { prisma } from '../../config/prisma';
import { CreateStationInput, UpdateStationInput, ReplaceStationGamesInput } from './station.types';
import { GamePlayMode, GameStationType, Prisma } from '@prisma/client';
import { ListStationsQuery } from './station.validator';
import { getPaginationParams, formatPaginatedResult } from '../../common/utils/pagination';
import { buildPersianArabicSearchVariants, normalizeSearchText } from '../../common/utils/searchText';

/**
 * Creates a new station for a given gamingCenter.
 */
export async function createStation(gamingCenterId: string, data: CreateStationInput) {
  const createInput: Prisma.GameStationUncheckedCreateInput = {
    ...(data as any), // eslint-disable-line @typescript-eslint/no-explicit-any
    gamingCenterId,
  };
  return prisma.gameStation.create({
    data: createInput,
  });
}

/**
 * Creates multiple stations in a transaction.
 */
export async function createManyStations(gamingCenterId: string, stationsData: CreateStationInput[]) {
  return prisma.$transaction(
    stationsData.map((data) =>
      prisma.gameStation.create({
        data: {
          ...(data as any), // eslint-disable-line @typescript-eslint/no-explicit-any
          gamingCenterId,
        },
      })
    )
  );
}

/**
 * Finds a station by its ID for a specific gamingCenter.
 */
export async function findStationById(stationId: string, gamingCenterId: string) {
  return prisma.gameStation.findFirst({
    where: { id: stationId, gamingCenterId },
  });
}

async function resolveGameIdsForStationFilter(
  gameQuery?: string,
  explicitGameCatalogId?: string
): Promise<Array<{ id: string; supportedPlatforms: GameStationType[] }> | null> {
  if (explicitGameCatalogId) {
    if (typeof prisma.gameCatalog?.findUnique !== 'function') {
      return [{ id: explicitGameCatalogId, supportedPlatforms: [] }];
    }
    const g = await prisma.gameCatalog.findUnique({
      where: { id: explicitGameCatalogId },
      select: { id: true, supportedPlatforms: true },
    });
    return g ? [g] : [];
  }

  if (!gameQuery) {
    return null;
  }

  if (typeof prisma.gameCatalog?.findMany !== 'function') {
    return null;
  }

  const variants = buildPersianArabicSearchVariants(gameQuery);
  const norm = normalizeSearchText(gameQuery);
  const hasAliases = typeof prisma.gameAlias?.findMany === 'function';

  const games = await prisma.gameCatalog.findMany({
    where: {
      isActive: true,
      OR: [
        ...variants.flatMap((v) => [
          { title: { contains: v, mode: 'insensitive' as const } },
          { titleFa: { contains: v, mode: 'insensitive' as const } },
          { titleEn: { contains: v, mode: 'insensitive' as const } },
          { slug: { contains: v, mode: 'insensitive' as const } },
        ]),
        ...(hasAliases && norm
          ? [{ aliases: { some: { normalized: { contains: norm, mode: 'insensitive' as const } } } }]
          : []),
      ],
    },
    select: { id: true, supportedPlatforms: true },
  });

  return games || [];
}

/**
 * Retrieves a list of stations for a given gamingCenter, with optional filtering.
 */
export async function findStationsByGamingCenterId(gamingCenterId: string, query: ListStationsQuery) {
  const {
    page,
    limit,
    search,
    isActive,
    sortBy,
    sortOrder,
    minPrice,
    maxPrice,
    catalogDeviceId,
    stationType,
    type,
    isVip,
    staffId,
    game,
    gameCatalogId,
    ids,
    fields,
  } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const resolvedStationType = stationType || type;

  const where: Prisma.GameStationWhereInput = {
    gamingCenterId,
    isActive: isActive !== undefined ? isActive : true,
    ...(catalogDeviceId ? { catalogDeviceId } : {}),
    ...(resolvedStationType ? { stationType: resolvedStationType } : {}),
    ...(isVip !== undefined ? { isVip } : {}),
  };

  if (ids && ids.length > 0) {
    where.id = { in: ids };
  }

  if (search) {
    const variants = buildPersianArabicSearchVariants(search);
    if (variants.length <= 1) {
      where.name = { contains: variants[0] ?? search, mode: 'insensitive' };
    } else {
      where.OR = variants.map((v) => ({ name: { contains: v, mode: 'insensitive' } }));
    }
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.hourlyPrice = {
      ...(minPrice !== undefined ? { gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
    };
  }

  if (staffId) {
    where.staffSkills = {
      some: {
        userId: staffId,
      },
    };
  }

  if (game || gameCatalogId) {
    const matchedGames = await resolveGameIdsForStationFilter(game, gameCatalogId);
    if (matchedGames && matchedGames.length === 0) {
      return formatPaginatedResult([], 0, page, limit);
    }
    if (matchedGames && matchedGames.length > 0) {
      const hasStationGameTable = typeof prisma.gameStationGame?.findMany === 'function';
      const hasCenterGameTable = typeof prisma.gamingCenterGame?.findMany === 'function';

      let centerGameLinks: Array<{ gameCatalogId: string; platforms: GameStationType[] }> = [];
      if (hasCenterGameTable) {
        centerGameLinks = await prisma.gamingCenterGame.findMany({
          where: {
            gamingCenterId,
            gameCatalogId: { in: matchedGames.map((g) => g.id) },
          },
          select: { gameCatalogId: true, platforms: true },
        });
      }
      const centerLinkByGame = new Map(centerGameLinks.map((c) => [c.gameCatalogId, c]));

      const gameConditions: Prisma.GameStationWhereInput[] = matchedGames.map((g) => {
        const centerLink = centerLinkByGame.get(g.id);
        const allowedPlatforms =
          centerLink && Array.isArray(centerLink.platforms) && centerLink.platforms.length > 0
            ? centerLink.platforms
            : g.supportedPlatforms;

        const fallbackViaCenter: Prisma.GameStationWhereInput | null = centerLink
          ? {
              AND: [
                ...(allowedPlatforms.length > 0 ? [{ stationType: { in: allowedPlatforms } }] : []),
                ...(hasStationGameTable
                  ? [{ stationGames: { none: { gameCatalogId: g.id, isActive: false } } }]
                  : []),
              ],
            }
          : null;

        if (hasStationGameTable && fallbackViaCenter) {
          return {
            OR: [
              { stationGames: { some: { gameCatalogId: g.id, isActive: true } } },
              fallbackViaCenter,
            ],
          };
        }
        if (hasStationGameTable) {
          return { stationGames: { some: { gameCatalogId: g.id, isActive: true } } };
        }
        if (fallbackViaCenter) {
          return fallbackViaCenter;
        }
        return { id: '__never__' };
      });

      const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [...existingAnd, { OR: gameConditions }];
    }
  }

  // Handle selective projection if fields are specified
  let select: Prisma.GameStationSelect | undefined = undefined;
  if (fields && fields.length > 0) {
    select = { id: true };
    for (const field of fields) {
      (select as Record<string, boolean>)[field] = true;
    }
  }

  const [data, total] = await Promise.all([
    prisma.gameStation.findMany({
      where,
      skip,
      take,
      orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      ...(select ? { select } : {}),
    }),
    prisma.gameStation.count({ where }),
  ]);

  return formatPaginatedResult(data, total, page, limit);
}

/**
 * Updates an existing station for a specific gamingCenter.
 */
export async function updateStation(stationId: string, gamingCenterId: string, data: UpdateStationInput) {
  await prisma.gameStation.updateMany({
    where: { id: stationId, gamingCenterId },
    data,
  });

  return findStationById(stationId, gamingCenterId);
}

/**
 * Deactivates a station (soft delete) for a specific gamingCenter.
 */
export async function deactivateStation(stationId: string, gamingCenterId: string) {
  await prisma.gameStation.updateMany({
    where: { id: stationId, gamingCenterId },
    data: { isActive: false },
  });
  return findStationById(stationId, gamingCenterId);
}

export async function findExplicitStationGames(stationId: string) {
  if (typeof prisma.gameStationGame?.findMany !== 'function') {
    return [];
  }
  return prisma.gameStationGame.findMany({
    where: { stationId, isActive: true },
    include: {
      gameCatalog: {
        include:
          typeof prisma.gameAlias?.findMany === 'function'
            ? { aliases: { orderBy: { createdAt: 'asc' } } }
            : undefined,
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function replaceExplicitStationGames(
  stationId: string,
  games: ReplaceStationGamesInput['games']
) {
  if (typeof prisma.gameStationGame?.upsert !== 'function') {
    return [];
  }

  const keepIds = games.map((g) => g.gameCatalogId);

  return prisma.$transaction(async (tx) => {
    await tx.gameStationGame.deleteMany({
      where: {
        stationId,
        ...(keepIds.length > 0 ? { gameCatalogId: { notIn: keepIds } } : {}),
      },
    });

    for (const item of games) {
      await tx.gameStationGame.upsert({
        where: {
          stationId_gameCatalogId: {
            stationId,
            gameCatalogId: item.gameCatalogId,
          },
        },
        update: {
          playMode: item.playMode ?? GamePlayMode.OFFLINE,
          isActive: item.isActive ?? true,
        },
        create: {
          stationId,
          gameCatalogId: item.gameCatalogId,
          playMode: item.playMode ?? GamePlayMode.OFFLINE,
          isActive: item.isActive ?? true,
        },
      });
    }

    return tx.gameStationGame.findMany({
      where: { stationId, isActive: true },
      include: { gameCatalog: true },
      orderBy: { createdAt: 'asc' },
    });
  });
}

export async function deleteExplicitStationGame(stationId: string, gameCatalogId: string) {
  if (typeof prisma.gameStationGame?.deleteMany !== 'function') {
    return { count: 0 };
  }
  return prisma.gameStationGame.deleteMany({
    where: { stationId, gameCatalogId },
  });
}
