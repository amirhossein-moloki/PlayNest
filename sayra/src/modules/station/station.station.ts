import { GamePlayMode, GameStationType, SessionActorType } from '@prisma/client';
import { auditService } from '../audit/audit.station';
import * as StationRepo from './station.repo';
import {
  CreateStationInput,
  UpdateStationInput,
  CreateStationsFromCatalogInput,
  AddGamesFromCatalogInput,
  ReplaceStationGamesInput,
} from './station.types';
import { ListStationsQuery } from './station.validator';
import * as CatalogRepo from '../catalog/catalog.repo';
import { prisma } from '../../config/prisma';
import { discountsStation } from '../discounts/discounts.station';
import { calculateStationPricing, StationPricing } from '../../common/utils/money';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { isConsoleStationType } from '../../common/utils/station-type';
import {
  ExtraControllerConfigInput,
  getStationExtraControllers,
  isExtraControllerSupportedForStation,
  replaceStationExtraControllers,
} from './extra-controller.service';

/**
 * Business logic to create stations from a DeviceCatalog entry.
 */
export async function createStationsFromCatalog(
  gamingCenterId: string,
  input: CreateStationsFromCatalogInput,
  actor?: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) {
  const catalogDevice = await CatalogRepo.findDeviceById(input.catalogDeviceId);
  if (!catalogDevice) {
    throw new AppError('Catalog device not found', httpStatus.NOT_FOUND);
  }

  // Count existing stations of this device or center to generate unique sequential names
  const existingCount = await prisma.gameStation.count({
    where: {
      gamingCenterId,
      stationType: catalogDevice.deviceType,
    },
  });

  const basePrefix = input.customNamePrefix || catalogDevice.name;
  const stationsToCreate: CreateStationInput[] = [];

  for (let i = 1; i <= input.quantity; i++) {
    const stationNumber = existingCount + i;
    stationsToCreate.push({
      name: `${basePrefix} #${stationNumber}`,
      stationType: catalogDevice.deviceType,
      deviceTypeId: catalogDevice.deviceTypeId ?? undefined,
      catalogDeviceId: catalogDevice.id,
      coverImageUrl: catalogDevice.coverImageUrl,
      hourlyPrice: input.hourlyPrice,
      isVip: input.isVip ?? false,
      minRentHours: input.minRentHours ?? 1,
      maxRentHours: input.maxRentHours ?? 8,
      defaultDurationHours: input.defaultDurationHours ?? 1,
      incrementMinutes: input.incrementMinutes ?? 30,
      isActive: true,
    } as CreateStationInput);
  }

  const createdStations = await StationRepo.createManyStations(gamingCenterId, stationsToCreate);

  const extraControllers = (input as CreateStationsFromCatalogInput & { extraControllers?: ExtraControllerConfigInput[] }).extraControllers;
  if (extraControllers && extraControllers.length > 0) {
    for (const st of createdStations) {
      await replaceStationExtraControllers(st.id, gamingCenterId, extraControllers);
    }
  }

  // Update gaming center PC/Console counts accordingly
  if (catalogDevice.deviceType === 'PC') {
    await prisma.gamingCenter.update({
      where: { id: gamingCenterId },
      data: { pcCount: { increment: input.quantity } },
    });
  } else if (isConsoleStationType(catalogDevice.deviceType)) {
    await prisma.gamingCenter.update({
      where: { id: gamingCenterId },
      data: { consoleCount: { increment: input.quantity } },
    });
  }

  if (actor) {
    await auditService.log(
      gamingCenterId,
      actor,
      'STATIONS_BULK_CREATE_FROM_CATALOG',
      { name: 'GameStation', id: catalogDevice.id },
      { new: { quantity: input.quantity, hourlyPrice: input.hourlyPrice, createdStationsCount: createdStations.length } },
      context
    );
  }

  return createdStations;
}

const formatEnrichedCenterGame = (
  catalogGame: {
    id: string;
    slug?: string | null;
    title: string;
    titleFa?: string | null;
    titleEn?: string | null;
    category?: string | null;
    coverImageUrl?: string | null;
    supportedPlatforms?: GameStationType[];
    genre?: string | null;
    description?: string | null;
    isActive?: boolean;
    supportsOnline?: boolean;
    aliases?: Array<{ alias: string; locale?: string | null }>;
  },
  playMode: GamePlayMode,
  extra?: {
    platforms?: GameStationType[];
    stations?: Array<{
      id: string;
      name: string;
      stationType: GameStationType | string;
      isVip: boolean;
      hourlyPrice: number;
      isActive: boolean;
    }>;
  }
) => {
  const supportsOnline = Boolean(catalogGame.supportsOnline);
  const supportedPlatforms = catalogGame.supportedPlatforms ?? [];
  const centerPlatforms =
    extra?.platforms && extra.platforms.length > 0 ? extra.platforms : supportedPlatforms;

  return {
    id: catalogGame.id,
    ...(catalogGame.slug !== undefined ? { slug: catalogGame.slug } : {}),
    title: catalogGame.title,
    ...(catalogGame.titleFa !== undefined ? { titleFa: catalogGame.titleFa } : {}),
    ...(catalogGame.titleEn !== undefined ? { titleEn: catalogGame.titleEn } : {}),
    ...(catalogGame.category !== undefined ? { category: catalogGame.category } : {}),
    coverImageUrl: catalogGame.coverImageUrl ?? null,
    supportedPlatforms,
    platforms: centerPlatforms,
    ...(Array.isArray(catalogGame.aliases)
      ? { aliases: catalogGame.aliases.map((a) => a.alias) }
      : {}),
    genre: catalogGame.genre ?? null,
    description: catalogGame.description ?? null,
    isActive: catalogGame.isActive ?? true,
    supportsOnline,
    playMode: supportsOnline ? playMode : GamePlayMode.OFFLINE,
    ...(extra?.stations !== undefined
      ? {
          availablePlatforms: Array.from(new Set(extra.stations.map((s) => s.stationType))),
          activeStationCount: extra.stations.length,
          stations: extra.stations,
        }
      : {}),
  };
};

/**
 * Business logic to add games from GameCatalog into GamingCenter's games list and GamingCenterGame mode table.
 */
export async function addGamesFromCatalog(
  gamingCenterId: string,
  input: AddGamesFromCatalogInput,
  actor?: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) {
  const requestedModeById = new Map<string, GamePlayMode>();
  const requestedPlatformsById = new Map<string, GameStationType[] | undefined>();
  const requestedStationIdsById = new Map<string, string[] | undefined>();

  if ('games' in input && Array.isArray(input.games)) {
    for (const item of input.games) {
      requestedModeById.set(item.gameCatalogId, item.playMode ?? GamePlayMode.OFFLINE);
      requestedPlatformsById.set(item.gameCatalogId, item.platforms);
      requestedStationIdsById.set(item.gameCatalogId, item.stationIds);
    }
  } else if ('gameCatalogIds' in input && Array.isArray(input.gameCatalogIds)) {
    for (const gameCatalogId of input.gameCatalogIds) {
      requestedModeById.set(gameCatalogId, GamePlayMode.OFFLINE);
    }
  }

  const requestedIds = Array.from(requestedModeById.keys());
  if (requestedIds.length === 0) {
    throw new AppError('At least one game must be provided', httpStatus.BAD_REQUEST);
  }

  const catalogGames = await prisma.gameCatalog.findMany({
    where: {
      id: { in: requestedIds },
    },
  });

  if (catalogGames.length === 0) {
    throw new AppError('No matching games found in catalog', httpStatus.NOT_FOUND);
  }

  if (catalogGames.length < requestedIds.length) {
    const foundIds = new Set(catalogGames.map((g) => g.id));
    const missingIds = requestedIds.filter((id) => !foundIds.has(id));
    throw new AppError(
      `One or more games were not found in catalog: ${missingIds.join(', ')}`,
      httpStatus.NOT_FOUND
    );
  }

  for (const game of catalogGames) {
    if (game.isActive === false) {
      throw new AppError(
        `Game "${game.title}" (${game.id}) is inactive and cannot be added.`,
        httpStatus.BAD_REQUEST,
        { code: 'GAME_INACTIVE', details: { gameCatalogId: game.id, title: game.title } }
      );
    }

    const requestedMode = requestedModeById.get(game.id) ?? GamePlayMode.OFFLINE;
    if (requestedMode === GamePlayMode.ONLINE && !game.supportsOnline) {
      throw new AppError(
        `Game "${game.title}" (${game.id}) does not support ONLINE play mode.`,
        httpStatus.BAD_REQUEST,
        {
          code: 'ONLINE_MODE_NOT_SUPPORTED',
          details: { gameCatalogId: game.id, title: game.title },
        }
      );
    }

    const requestedPlatforms = requestedPlatformsById.get(game.id);
    if (
      requestedPlatforms &&
      requestedPlatforms.length > 0 &&
      Array.isArray(game.supportedPlatforms) &&
      game.supportedPlatforms.length > 0
    ) {
      const invalidPlatform = requestedPlatforms.find(
        (p) => !game.supportedPlatforms.includes(p)
      );
      if (invalidPlatform) {
        throw new AppError(
          `Platform "${invalidPlatform}" is not supported by game "${game.title}".`,
          httpStatus.BAD_REQUEST,
          {
            code: 'PLATFORM_NOT_SUPPORTED',
            details: { gameCatalogId: game.id, invalidPlatform, supportedPlatforms: game.supportedPlatforms },
          }
        );
      }
    }
  }

  // Validate stationIds if provided on any item
  const allRequestedStationIds = Array.from(
    new Set(
      Array.from(requestedStationIdsById.values())
        .flat()
        .filter((v): v is string => Boolean(v))
    )
  );
  const stationById = new Map<string, { id: string; stationType: GameStationType; isActive: boolean }>();
  if (allRequestedStationIds.length > 0 && typeof prisma.gameStation?.findMany === 'function') {
    const stations = await prisma.gameStation.findMany({
      where: {
        gamingCenterId,
        id: { in: allRequestedStationIds },
      },
      select: { id: true, stationType: true, isActive: true },
    });
    for (const s of stations) {
      stationById.set(s.id, s);
    }
    for (const sid of allRequestedStationIds) {
      if (!stationById.has(sid)) {
        throw new AppError(`Station "${sid}" not found in this gaming center.`, httpStatus.NOT_FOUND);
      }
    }
  }

  const center = await prisma.gamingCenter.findUnique({
    where: { id: gamingCenterId },
    select: { games: true },
  });

  if (!center) {
    throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
  }

  const existingGameTitles = new Set(center.games || []);
  const newTitles = catalogGames.map((g) => g.title).filter((title) => !existingGameTitles.has(title));
  const updatedGames = [...(center.games || []), ...newTitles];

  const configuredGames = catalogGames.map((game) => ({
    gameCatalogId: game.id,
    title: game.title,
    playMode: requestedModeById.get(game.id) ?? GamePlayMode.OFFLINE,
    ...(requestedPlatformsById.get(game.id) ? { platforms: requestedPlatformsById.get(game.id) } : {}),
  }));

  const syncGamesInClient = async (client: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
    if (typeof client.gamingCenterGame?.upsert === 'function') {
      for (const game of catalogGames) {
        const playMode = requestedModeById.get(game.id) ?? GamePlayMode.OFFLINE;
        const platforms = requestedPlatformsById.get(game.id);
        await client.gamingCenterGame.upsert({
          where: {
            gamingCenterId_gameCatalogId: {
              gamingCenterId,
              gameCatalogId: game.id,
            },
          },
          update: {
            playMode,
            ...(platforms !== undefined ? { platforms } : {}),
          },
          create: {
            gamingCenterId,
            gameCatalogId: game.id,
            playMode,
            ...(platforms !== undefined ? { platforms } : {}),
          },
        });

        const stationIds = requestedStationIdsById.get(game.id);
        if (
          stationIds &&
          stationIds.length > 0 &&
          typeof client.gameStationGame?.upsert === 'function'
        ) {
          const allowedPlatforms =
            platforms && platforms.length > 0 ? platforms : game.supportedPlatforms || [];
          for (const sid of stationIds) {
            const st = stationById.get(sid);
            if (st && allowedPlatforms.length > 0 && !allowedPlatforms.includes(st.stationType)) {
              throw new AppError(
                `Station "${sid}" (${st.stationType}) is incompatible with "${game.title}".`,
                httpStatus.BAD_REQUEST,
                { code: 'STATION_PLATFORM_INCOMPATIBLE' }
              );
            }
            await client.gameStationGame.upsert({
              where: {
                stationId_gameCatalogId: {
                  stationId: sid,
                  gameCatalogId: game.id,
                },
              },
              update: { playMode, isActive: true },
              create: {
                stationId: sid,
                gameCatalogId: game.id,
                playMode,
                isActive: true,
              },
            });
          }
        }
      }
    }

    return client.gamingCenter.update({
      where: { id: gamingCenterId },
      data: { games: updatedGames },
      select: { id: true, name: true, games: true },
    });
  };

  const updatedCenter =
    typeof prisma.$transaction === 'function'
      ? await prisma.$transaction((tx) => syncGamesInClient(tx))
      : await syncGamesInClient(prisma);

  if (actor) {
    await auditService.log(
      gamingCenterId,
      actor,
      'GAMING_CENTER_ADD_GAMES_FROM_CATALOG',
      { name: 'GamingCenter', id: gamingCenterId },
      {
        old: { games: center.games },
        new: { games: updatedGames, added: newTitles, configuredGames },
      },
      context
    );
  }

  const enrichedGames = catalogGames.map((game) =>
    formatEnrichedCenterGame(game, requestedModeById.get(game.id) ?? GamePlayMode.OFFLINE, {
      platforms: requestedPlatformsById.get(game.id),
    })
  );

  return {
    gamingCenterId,
    addedGames: newTitles,
    allGames: updatedCenter.games,
    games: enrichedGames,
  };
}

/**
 * Updates playMode (OFFLINE / ONLINE) for a game already associated with a gaming center.
 */
export async function updateGamingCenterGameMode(
  gamingCenterId: string,
  gameId: string,
  playMode: GamePlayMode,
  actor?: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) {
  const center = await prisma.gamingCenter.findUnique({
    where: { id: gamingCenterId },
    select: { id: true, games: true },
  });

  if (!center) {
    throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
  }

  let catalogGame: {
    id: string;
    title: string;
    coverImageUrl?: string | null;
    supportedPlatforms?: GameStationType[];
    genre?: string | null;
    description?: string | null;
    isActive?: boolean;
    supportsOnline?: boolean;
  } | null = null;
  let previousPlayMode: GamePlayMode = GamePlayMode.OFFLINE;

  if (typeof prisma.gamingCenterGame?.findFirst === 'function') {
    const existingCenterGame = await prisma.gamingCenterGame.findFirst({
      where: {
        gamingCenterId,
        OR: [{ gameCatalogId: gameId }, { id: gameId }],
      },
      include: { gameCatalog: true },
    });

    if (existingCenterGame?.gameCatalog) {
      catalogGame = existingCenterGame.gameCatalog;
      previousPlayMode = existingCenterGame.playMode;
    }
  }

  if (!catalogGame) {
    const fallbackCatalog = await prisma.gameCatalog.findUnique({
      where: { id: gameId },
    });
    if (fallbackCatalog && (center.games || []).includes(fallbackCatalog.title)) {
      catalogGame = fallbackCatalog;
      previousPlayMode = GamePlayMode.OFFLINE;
    }
  }

  if (!catalogGame) {
    throw new AppError('Game not found in this gaming center', httpStatus.NOT_FOUND);
  }

  if (playMode === GamePlayMode.ONLINE && !catalogGame.supportsOnline) {
    throw new AppError(
      `Game "${catalogGame.title}" (${catalogGame.id}) does not support ONLINE play mode.`,
      httpStatus.BAD_REQUEST,
      {
        code: 'ONLINE_MODE_NOT_SUPPORTED',
        details: { gameCatalogId: catalogGame.id, title: catalogGame.title },
      }
    );
  }

  const updatedRecord = await prisma.gamingCenterGame.upsert({
    where: {
      gamingCenterId_gameCatalogId: {
        gamingCenterId,
        gameCatalogId: catalogGame.id,
      },
    },
    update: { playMode },
    create: {
      gamingCenterId,
      gameCatalogId: catalogGame.id,
      playMode,
    },
  });

  if (actor) {
    await auditService.log(
      gamingCenterId,
      actor,
      'GAMING_CENTER_UPDATE_GAME_MODE',
      { name: 'GamingCenterGame', id: updatedRecord.id },
      {
        old: { gameCatalogId: catalogGame.id, title: catalogGame.title, playMode: previousPlayMode },
        new: { gameCatalogId: catalogGame.id, title: catalogGame.title, playMode: updatedRecord.playMode },
      },
      context
    );
  }

  return formatEnrichedCenterGame(catalogGame, updatedRecord.playMode);
}

/**
 * Returns the games selected by a gaming center, enriched with GameCatalog metadata, supportsOnline, playMode, and compatible stations.
 */
export async function getGamesForGamingCenter(
  gamingCenterId: string,
  options?: { playMode?: GamePlayMode }
) {
  const center = await prisma.gamingCenter.findUnique({
    where: { id: gamingCenterId },
    select: { id: true, games: true },
  });

  if (!center) {
    throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
  }

  const gameTitles = center.games || [];
  const hasAliasesInclude = typeof prisma.gameAlias?.findMany === 'function';
  const centerGames =
    typeof prisma.gamingCenterGame?.findMany === 'function'
      ? await prisma.gamingCenterGame.findMany({
          where: { gamingCenterId },
          include: {
            gameCatalog: hasAliasesInclude
              ? { include: { aliases: { orderBy: { createdAt: 'asc' } } } }
              : true,
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

  if (gameTitles.length === 0 && centerGames.length === 0) {
    return [];
  }

  const activeStations =
    typeof prisma.gameStation?.findMany === 'function'
      ? ((await prisma.gameStation.findMany({
          where: { gamingCenterId, isActive: true },
          select: {
            id: true,
            name: true,
            stationType: true,
            isVip: true,
            hourlyPrice: true,
            isActive: true,
          },
        })) ?? [])
      : undefined;

  const explicitStationGames =
    activeStations && typeof prisma.gameStationGame?.findMany === 'function'
      ? ((await prisma.gameStationGame.findMany({
          where: {
            station: { gamingCenterId },
          },
          select: {
            stationId: true,
            gameCatalogId: true,
            isActive: true,
          },
        })) ?? [])
      : [];

  const stationById = new Map((activeStations ?? []).map((s) => [s.id, s]));
  const explicitByGame = new Map<string, Array<{ stationId: string; isActive: boolean }>>();
  for (const sg of explicitStationGames) {
    const arr = explicitByGame.get(sg.gameCatalogId) ?? [];
    arr.push({ stationId: sg.stationId, isActive: sg.isActive });
    explicitByGame.set(sg.gameCatalogId, arr);
  }

  const resolveCompatibleStations = (
    gameCatalogId: string | null,
    allowedPlatforms: GameStationType[]
  ) => {
    if (!activeStations) return undefined;
    if (gameCatalogId) {
      const explicitList = explicitByGame.get(gameCatalogId) ?? [];
      const activeExplicit = explicitList
        .filter((e) => e.isActive && stationById.has(e.stationId))
        .map((e) => stationById.get(e.stationId)!);
      const disabledStationIds = new Set(
        explicitList.filter((e) => !e.isActive).map((e) => e.stationId)
      );
      if (activeExplicit.length > 0) {
        return activeExplicit;
      }
      if (allowedPlatforms.length === 0) {
        return activeStations.filter((s) => !disabledStationIds.has(s.id));
      }
      return activeStations.filter(
        (s) =>
          allowedPlatforms.includes(s.stationType as GameStationType) &&
          !disabledStationIds.has(s.id)
      );
    }
    return undefined;
  };

  const centerGameByTitle = new Map<string, (typeof centerGames)[number]>();
  for (const cg of centerGames) {
    if (cg.gameCatalog?.title) {
      centerGameByTitle.set(cg.gameCatalog.title, cg);
    }
  }

  const unmatchedTitles = gameTitles.filter((title) => !centerGameByTitle.has(title));
  const catalogGames =
    (unmatchedTitles.length > 0 && typeof prisma.gameCatalog?.findMany === 'function'
      ? await prisma.gameCatalog.findMany({
          where: {
            title: { in: unmatchedTitles },
          },
          ...(hasAliasesInclude ? { include: { aliases: { orderBy: { createdAt: 'asc' } } } } : {}),
        })
      : []) || [];

  const catalogByTitle = new Map(catalogGames.map((g) => [g.title, g]));
  const emittedCatalogIds = new Set<string>();

  const enriched = gameTitles.map((title) => {
    const centerGameMatch = centerGameByTitle.get(title);
    if (centerGameMatch?.gameCatalog) {
      emittedCatalogIds.add(centerGameMatch.gameCatalog.id);
      const centerPlatforms = (centerGameMatch as { platforms?: GameStationType[] }).platforms;
      const allowedPlatforms =
        centerPlatforms && centerPlatforms.length > 0
          ? centerPlatforms
          : centerGameMatch.gameCatalog.supportedPlatforms ?? [];
      return formatEnrichedCenterGame(centerGameMatch.gameCatalog, centerGameMatch.playMode, {
        platforms: centerPlatforms,
        stations: resolveCompatibleStations(centerGameMatch.gameCatalog.id, allowedPlatforms),
      });
    }

    const catalogMatch = catalogByTitle.get(title);
    if (catalogMatch) {
      emittedCatalogIds.add(catalogMatch.id);
      return formatEnrichedCenterGame(catalogMatch, GamePlayMode.OFFLINE, {
        stations: resolveCompatibleStations(catalogMatch.id, catalogMatch.supportedPlatforms ?? []),
      });
    }

    return {
      id: null,
      title,
      coverImageUrl: null,
      supportedPlatforms: [],
      platforms: [],
      genre: null,
      description: null,
      isActive: true,
      supportsOnline: false,
      playMode: GamePlayMode.OFFLINE,
    };
  });

  for (const cg of centerGames) {
    if (cg.gameCatalog && !emittedCatalogIds.has(cg.gameCatalog.id)) {
      emittedCatalogIds.add(cg.gameCatalog.id);
      const centerPlatforms = (cg as { platforms?: GameStationType[] }).platforms;
      const allowedPlatforms =
        centerPlatforms && centerPlatforms.length > 0
          ? centerPlatforms
          : cg.gameCatalog.supportedPlatforms ?? [];
      enriched.push(
        formatEnrichedCenterGame(cg.gameCatalog, cg.playMode, {
          platforms: centerPlatforms,
          stations: resolveCompatibleStations(cg.gameCatalog.id, allowedPlatforms),
        })
      );
    }
  }

  if (options?.playMode) {
    return enriched.filter((g) => g.playMode === options.playMode);
  }

  return enriched;
}

export async function getStationGames(stationId: string, gamingCenterId: string) {
  const station = await StationRepo.findStationById(stationId, gamingCenterId);
  if (!station) {
    throw new AppError('GameStation not found', httpStatus.NOT_FOUND);
  }

  const explicitGames = await StationRepo.findExplicitStationGames(stationId);
  if (explicitGames.length > 0) {
    return explicitGames.map((sg) =>
      formatEnrichedCenterGame(sg.gameCatalog, sg.playMode)
    );
  }

  // Fallback to center-level games compatible with this station's device type
  const centerGames = await getGamesForGamingCenter(gamingCenterId);
  return centerGames.filter((g) => {
    const platforms = (g.platforms || g.supportedPlatforms || []) as GameStationType[];
    return platforms.length === 0 || platforms.includes(station.stationType);
  });
}

export async function replaceStationGames(
  stationId: string,
  gamingCenterId: string,
  input: ReplaceStationGamesInput,
  actor?: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) {
  const station = await StationRepo.findStationById(stationId, gamingCenterId);
  if (!station) {
    throw new AppError('GameStation not found', httpStatus.NOT_FOUND);
  }

  const requestedIds = Array.from(new Set(input.games.map((g) => g.gameCatalogId)));
  if (requestedIds.length > 0) {
    const catalogGames = await prisma.gameCatalog.findMany({
      where: { id: { in: requestedIds } },
    });
    const byId = new Map(catalogGames.map((g) => [g.id, g]));

    for (const item of input.games) {
      const cat = byId.get(item.gameCatalogId);
      if (!cat) {
        throw new AppError(`Game "${item.gameCatalogId}" not found in catalog`, httpStatus.NOT_FOUND);
      }
      if (!cat.isActive) {
        throw new AppError(`Game "${cat.title}" is inactive`, httpStatus.BAD_REQUEST);
      }
      if (
        Array.isArray(cat.supportedPlatforms) &&
        cat.supportedPlatforms.length > 0 &&
        !cat.supportedPlatforms.includes(station.stationType)
      ) {
        throw new AppError(
          `Game "${cat.title}" does not support station type "${station.stationType}"`,
          httpStatus.BAD_REQUEST,
          { code: 'STATION_PLATFORM_INCOMPATIBLE' }
        );
      }
      if (item.playMode === GamePlayMode.ONLINE && !cat.supportsOnline) {
        throw new AppError(
          `Game "${cat.title}" does not support ONLINE play mode.`,
          httpStatus.BAD_REQUEST,
          { code: 'ONLINE_MODE_NOT_SUPPORTED' }
        );
      }
    }

    // Also ensure center-level GamingCenterGame links exist for search consistency
    if (typeof prisma.gamingCenterGame?.upsert === 'function') {
      for (const item of input.games) {
        if (item.isActive === false) continue;
        await prisma.gamingCenterGame.upsert({
          where: {
            gamingCenterId_gameCatalogId: {
              gamingCenterId,
              gameCatalogId: item.gameCatalogId,
            },
          },
          update: {},
          create: {
            gamingCenterId,
            gameCatalogId: item.gameCatalogId,
            playMode: item.playMode ?? GamePlayMode.OFFLINE,
          },
        });
      }
    }
  }

  const updated = await StationRepo.replaceExplicitStationGames(stationId, input.games);

  if (actor) {
    await auditService.log(
      gamingCenterId,
      actor,
      'STATION_REPLACE_GAMES',
      { name: 'GameStation', id: stationId },
      { new: { gamesCount: updated.length } },
      context
    );
  }

  return updated.map((sg) => formatEnrichedCenterGame(sg.gameCatalog, sg.playMode));
}

export async function removeStationGame(
  stationId: string,
  gamingCenterId: string,
  gameCatalogId: string,
  actor?: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) {
  const station = await StationRepo.findStationById(stationId, gamingCenterId);
  if (!station) {
    throw new AppError('GameStation not found', httpStatus.NOT_FOUND);
  }

  await StationRepo.deleteExplicitStationGame(stationId, gameCatalogId);

  if (actor) {
    await auditService.log(
      gamingCenterId,
      actor,
      'STATION_REMOVE_GAME',
      { name: 'GameStation', id: stationId },
      { new: { removedGameCatalogId: gameCatalogId } },
      context
    );
  }

  return { stationId, removedGameCatalogId: gameCatalogId };
}

/**
 * Removes a game (by GameCatalog ID, GamingCenterGame ID, or title) from a gaming center's games list.
 */
export async function removeGameFromGamingCenter(
  gamingCenterId: string,
  gameIdOrTitle: string,
  actor?: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) {
  const center = await prisma.gamingCenter.findUnique({
    where: { id: gamingCenterId },
    select: { id: true, games: true },
  });

  if (!center) {
    throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
  }

  const catalogGame = await prisma.gameCatalog.findUnique({
    where: { id: gameIdOrTitle },
    select: { id: true, title: true },
  });

  const matchedCenterGame =
    typeof prisma.gamingCenterGame?.findFirst === 'function'
      ? await prisma.gamingCenterGame.findFirst({
        where: {
          gamingCenterId,
          OR: [
            { gameCatalogId: gameIdOrTitle },
            { id: gameIdOrTitle },
            { gameCatalog: { title: gameIdOrTitle } },
          ],
        },
        include: {
          gameCatalog: { select: { id: true, title: true } },
        },
      })
      : null;

  const targetCatalogId = catalogGame?.id ?? matchedCenterGame?.gameCatalogId ?? null;
  const targetTitle = catalogGame?.title ?? matchedCenterGame?.gameCatalog?.title ?? gameIdOrTitle;
  const currentGames = center.games || [];

  if (!currentGames.includes(targetTitle) && !matchedCenterGame) {
    throw new AppError('Game not found in this gaming center', httpStatus.NOT_FOUND);
  }

  const updatedGames = currentGames.filter((t) => t !== targetTitle);

  const deleteWhere = targetCatalogId
    ? { gamingCenterId, gameCatalogId: targetCatalogId }
    : matchedCenterGame
      ? { id: matchedCenterGame.id }
      : null;

  if (typeof prisma.$transaction === 'function' && typeof prisma.gamingCenterGame?.deleteMany === 'function') {
    await prisma.$transaction(async (tx) => {
      if (deleteWhere && typeof tx.gamingCenterGame?.deleteMany === 'function') {
        await tx.gamingCenterGame.deleteMany({ where: deleteWhere });
      }
      await tx.gamingCenter.update({
        where: { id: gamingCenterId },
        data: { games: updatedGames },
      });
    });
  } else {
    if (deleteWhere && typeof prisma.gamingCenterGame?.deleteMany === 'function') {
      await prisma.gamingCenterGame.deleteMany({ where: deleteWhere });
    }
    await prisma.gamingCenter.update({
      where: { id: gamingCenterId },
      data: { games: updatedGames },
    });
  }

  if (actor) {
    await auditService.log(
      gamingCenterId,
      actor,
      'GAMING_CENTER_REMOVE_GAME',
      { name: 'GamingCenter', id: gamingCenterId },
      { old: { games: currentGames }, new: { games: updatedGames, removed: targetTitle } },
      context
    );
  }

  return {
    gamingCenterId,
    removedGame: targetTitle,
    allGames: updatedGames,
  };
}

/**
 * Business logic to create a new station.
 * @param gamingCenterId - The ID of the gamingCenter.
 * @param data - The data for the new station.
 * @returns The newly created station.
 */
export async function createStation(gamingCenterId: string, data: CreateStationInput) {
  const { extraControllers, ...stationData } = data as CreateStationInput & {
    extraControllers?: ExtraControllerConfigInput[];
  };
  const created = await StationRepo.createStation(gamingCenterId, stationData);
  if (extraControllers && extraControllers.length > 0) {
    const controllers = await replaceStationExtraControllers(created.id, gamingCenterId, extraControllers);
    return { ...created, extraControllers: controllers };
  }
  return created;
}

/**
 * Business logic to get a single station by its ID for a specific gamingCenter.
 * @param stationId - The ID of the station.
 * @param gamingCenterId - The ID of the gamingCenter.
 * @returns The station object.
 * @throws {HttpError} 404 if the station is not found in this gamingCenter.
 */
export async function getStationById(stationId: string, gamingCenterId: string) {
  const station = await StationRepo.findStationById(stationId, gamingCenterId);
  if (!station) {
    throw new AppError('GameStation not found', httpStatus.NOT_FOUND);
  }

  const { applicableDiscount } = await discountsStation.calculateApplicableDiscount(
    gamingCenterId,
    station.id,
    station.hourlyPrice
  );

  const pricing = calculateStationPricing(station.hourlyPrice, applicableDiscount, 1);
  const [extraControllerEnabled, extraControllers] = await Promise.all([
    isExtraControllerSupportedForStation(station.id),
    getStationExtraControllers(station.id, { gamingCenterId }),
  ]);

  return {
    ...station,
    pricing,
    extraControllerEnabled,
    extraControllers,
  };
}

/**
 * Business logic to get all stations for a gamingCenter.
 * @param gamingCenterId - The ID of the gamingCenter.
 * @param query - Filtering and pagination criteria.
 * @returns A list of stations with enriched pricing details.
 */
export async function getStationsForGamingCenter(gamingCenterId: string, query: ListStationsQuery) {
  const paginatedResult = await StationRepo.findStationsByGamingCenterId(gamingCenterId, query);
  const now = new Date();

  // Fetch all active discounts for this gaming center (center-level and station-level)
  let activeDiscounts: Array<{
    id: string;
    targetType: string;
    targetId: string;
    valueType: 'PERCENTAGE' | 'FIXED_AMOUNT';
    value: number;
    startAt: Date;
    endAt: Date;
    isActive: boolean;
  }> = [];

  try {
    if (prisma.discount?.findMany) {
      activeDiscounts = await prisma.discount.findMany({
        where: {
          gamingCenterId,
          isActive: true,
          startAt: { lte: now },
          endAt: { gte: now },
        },
      });
    }
  } catch {
    activeDiscounts = [];
  }

  const enrichedData = (paginatedResult.data || []).map((station: { [key: string]: unknown }) => {
    // If fields were selectively requested and hourlyPrice was omitted, return as is
    if (typeof station.hourlyPrice !== 'number') {
      return station;
    }

    const stationHourlyPrice = station.hourlyPrice;
    const stationId = station.id as string;

    const stationDiscounts = activeDiscounts.filter(
      (d) =>
        (d.targetType === 'STATION' && d.targetId === stationId) ||
        (d.targetType === 'GAMING_CENTER' && d.targetId === gamingCenterId)
    );

    // Apply STATION > GAMING_CENTER precedence logic
    const specificStationDiscounts = stationDiscounts.filter((d) => d.targetType === 'STATION');
    const candidates = specificStationDiscounts.length > 0
      ? specificStationDiscounts
      : stationDiscounts.filter((d) => d.targetType === 'GAMING_CENTER');

    let bestDiscount: (typeof activeDiscounts)[0] | null = null;
    let maxDiscountAmount = -1;

    for (const d of candidates) {
      let amt = 0;
      if (d.valueType === 'PERCENTAGE') {
        amt = (stationHourlyPrice * d.value) / 100;
      } else if (d.valueType === 'FIXED_AMOUNT') {
        amt = d.value;
      }
      amt = Math.min(stationHourlyPrice, Math.max(0, amt));
      if (amt > maxDiscountAmount) {
        maxDiscountAmount = amt;
        bestDiscount = d;
      }
    }

    const pricing: StationPricing = calculateStationPricing(
      stationHourlyPrice,
      maxDiscountAmount > 0 ? bestDiscount : null,
      1,
      now
    );

    return {
      ...station,
      pricing,
    };
  });

  return {
    ...paginatedResult,
    data: enrichedData,
  };
}

/**
 * Returns active device categories/catalogs for a given gaming center,
 * including station counts per category.
 */
export async function getDeviceCategoriesForGamingCenter(gamingCenterId: string) {
  // Query all active stations for this gaming center including their catalogDevice relation
  const stations = await prisma.gameStation.findMany({
    where: {
      gamingCenterId,
      isActive: true,
    },
    include: {
      catalogDevice: true,
    },
  });

  // Map to group categories by catalogId or fallback stationType
  type CategoryGroup = {
    catalogId: string | null;
    name: string;
    deviceType: string;
    coverImageUrl: string | null;
    deviceCount: number;
  };

  const categoriesMap = new Map<string, CategoryGroup>();

  for (const station of stations) {
    if (station.catalogDevice) {
      const key = `catalog_${station.catalogDevice.id}`;
      const existing = categoriesMap.get(key);
      if (existing) {
        existing.deviceCount += 1;
      } else {
        categoriesMap.set(key, {
          catalogId: station.catalogDevice.id,
          name: station.catalogDevice.name,
          deviceType: station.catalogDevice.deviceType,
          coverImageUrl: station.catalogDevice.coverImageUrl,
          deviceCount: 1,
        });
      }
    } else {
      // Fallback categorization for stations without a catalogDevice
      const key = `type_${station.stationType}`;
      const existing = categoriesMap.get(key);
      if (existing) {
        existing.deviceCount += 1;
      } else {
        categoriesMap.set(key, {
          catalogId: null,
          name: station.stationType,
          deviceType: station.stationType,
          coverImageUrl: station.coverImageUrl ?? null,
          deviceCount: 1,
        });
      }
    }
  }

  return Array.from(categoriesMap.values());
}

/**
 * Business logic to update a station for a specific gamingCenter.
 * @param stationId - The ID of the station to update.
 * @param gamingCenterId - The ID of the gamingCenter.
 * @param data - The data to update.
 * @returns The updated station.
 * @throws {HttpError} 404 if the station is not found in this gamingCenter.
 */
export async function updateStation(
  stationId: string,
  gamingCenterId: string,
  data: UpdateStationInput,
  actor: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) {
  // First, ensure the station exists within this gamingCenter before updating.
  const oldStation = await getStationById(stationId, gamingCenterId);
  const { extraControllers, ...stationData } = data as UpdateStationInput & {
    extraControllers?: ExtraControllerConfigInput[];
  };
  const updatedStation =
    Object.keys(stationData).length > 0
      ? await StationRepo.updateStation(stationId, gamingCenterId, stationData)
      : oldStation;

  if (extraControllers !== undefined) {
    await replaceStationExtraControllers(stationId, gamingCenterId, extraControllers);
  }

  // Log if price changed
  if (data.hourlyPrice !== undefined && data.hourlyPrice !== oldStation.hourlyPrice) {
    await auditService.log(
      gamingCenterId,
      actor,
      'STATION_PRICE_UPDATE',
      { name: 'GameStation', id: stationId },
      { old: oldStation, new: updatedStation },
      context
    );
  } else {
    await auditService.log(
      gamingCenterId,
      actor,
      'STATION_UPDATE',
      { name: 'GameStation', id: stationId },
      { old: oldStation, new: updatedStation },
      context
    );
  }

  return updatedStation;
}

/**
 * Business logic to deactivate a station for a specific gamingCenter.
 * @param stationId - The ID of the station to deactivate.
 *param gamingCenterId - The ID of the gamingCenter.
 * @returns The deactivated station.
 * @throws {HttpError} 404 if the station is not found in this gamingCenter.
 */
export async function deactivateStation(
  stationId: string,
  gamingCenterId: string,
  actor: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) {
  // First, ensure the station exists within this gamingCenter before deactivating.
  const oldStation = await getStationById(stationId, gamingCenterId);
  const updatedStation = await StationRepo.deactivateStation(stationId, gamingCenterId);

  await auditService.log(
    gamingCenterId,
    actor,
    'STATION_DEACTIVATE',
    { name: 'GameStation', id: stationId },
    { old: oldStation, new: updatedStation },
    context
  );

  return updatedStation;
}
