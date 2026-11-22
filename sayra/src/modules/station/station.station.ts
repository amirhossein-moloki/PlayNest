import { GamePlayMode, GameStationType, SessionActorType } from '@prisma/client';
import { auditService } from '../audit/audit.station';
import * as StationRepo from './station.repo';
import {
  CreateStationInput,
  UpdateStationInput,
  CreateStationsFromCatalogInput,
  AddGamesFromCatalogInput,
} from './station.types';
import { ListStationsQuery } from './station.validator';
import * as CatalogRepo from '../catalog/catalog.repo';
import { prisma } from '../../config/prisma';
import { discountsStation } from '../discounts/discounts.station';
import { calculateStationPricing, StationPricing } from '../../common/utils/money';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
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
  } else if (['PLAYSTATION', 'XBOX', 'SWITCH', 'VR'].includes(catalogDevice.deviceType)) {
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
    title: string;
    coverImageUrl?: string | null;
    supportedPlatforms?: GameStationType[];
    genre?: string | null;
    description?: string | null;
    isActive?: boolean;
    supportsOnline?: boolean;
  },
  playMode: GamePlayMode
) => {
  const supportsOnline = Boolean(catalogGame.supportsOnline);
  return {
    id: catalogGame.id,
    title: catalogGame.title,
    coverImageUrl: catalogGame.coverImageUrl ?? null,
    supportedPlatforms: catalogGame.supportedPlatforms ?? [],
    genre: catalogGame.genre ?? null,
    description: catalogGame.description ?? null,
    isActive: catalogGame.isActive ?? true,
    supportsOnline,
    playMode: supportsOnline ? playMode : GamePlayMode.OFFLINE,
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
  if ('games' in input && Array.isArray(input.games)) {
    for (const item of input.games) {
      requestedModeById.set(item.gameCatalogId, item.playMode ?? GamePlayMode.OFFLINE);
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
  }));

  const updatedCenter = await (async () => {
    if (typeof prisma.$transaction === 'function') {
      return prisma.$transaction(async (tx) => {
        if (typeof tx.gamingCenterGame?.upsert === 'function') {
          for (const game of catalogGames) {
            const playMode = requestedModeById.get(game.id) ?? GamePlayMode.OFFLINE;
            await tx.gamingCenterGame.upsert({
              where: {
                gamingCenterId_gameCatalogId: {
                  gamingCenterId,
                  gameCatalogId: game.id,
                },
              },
              update: { playMode },
              create: {
                gamingCenterId,
                gameCatalogId: game.id,
                playMode,
              },
            });
          }
        }

        return tx.gamingCenter.update({
          where: { id: gamingCenterId },
          data: { games: updatedGames },
          select: { id: true, name: true, games: true },
        });
      });
    }

    if (typeof prisma.gamingCenterGame?.upsert === 'function') {
      for (const game of catalogGames) {
        const playMode = requestedModeById.get(game.id) ?? GamePlayMode.OFFLINE;
        await prisma.gamingCenterGame.upsert({
          where: {
            gamingCenterId_gameCatalogId: {
              gamingCenterId,
              gameCatalogId: game.id,
            },
          },
          update: { playMode },
          create: {
            gamingCenterId,
            gameCatalogId: game.id,
            playMode,
          },
        });
      }
    }

    return prisma.gamingCenter.update({
      where: { id: gamingCenterId },
      data: { games: updatedGames },
      select: { id: true, name: true, games: true },
    });
  })();

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
    formatEnrichedCenterGame(game, requestedModeById.get(game.id) ?? GamePlayMode.OFFLINE)
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
 * Returns the games selected by a gaming center, enriched with GameCatalog metadata, supportsOnline, and playMode.
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
  const centerGames =
    typeof prisma.gamingCenterGame?.findMany === 'function'
      ? await prisma.gamingCenterGame.findMany({
        where: { gamingCenterId },
        include: { gameCatalog: true },
        orderBy: { createdAt: 'asc' },
      })
      : [];

  if (gameTitles.length === 0 && centerGames.length === 0) {
    return [];
  }

  const centerGameByTitle = new Map<string, (typeof centerGames)[number]>();
  for (const cg of centerGames) {
    if (cg.gameCatalog?.title) {
      centerGameByTitle.set(cg.gameCatalog.title, cg);
    }
  }

  const unmatchedTitles = gameTitles.filter((title) => !centerGameByTitle.has(title));
  const catalogGames =
    (unmatchedTitles.length > 0
      ? await prisma.gameCatalog.findMany({
        where: {
          title: { in: unmatchedTitles },
        },
      })
      : []) || [];

  const catalogByTitle = new Map(catalogGames.map((g) => [g.title, g]));
  const emittedCatalogIds = new Set<string>();

  const enriched = gameTitles.map((title) => {
    const centerGameMatch = centerGameByTitle.get(title);
    if (centerGameMatch?.gameCatalog) {
      emittedCatalogIds.add(centerGameMatch.gameCatalog.id);
      return formatEnrichedCenterGame(centerGameMatch.gameCatalog, centerGameMatch.playMode);
    }

    const catalogMatch = catalogByTitle.get(title);
    if (catalogMatch) {
      emittedCatalogIds.add(catalogMatch.id);
      return formatEnrichedCenterGame(catalogMatch, GamePlayMode.OFFLINE);
    }

    return {
      id: null,
      title,
      coverImageUrl: null,
      supportedPlatforms: [],
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
      enriched.push(formatEnrichedCenterGame(cg.gameCatalog, cg.playMode));
    }
  }

  if (options?.playMode) {
    return enriched.filter((g) => g.playMode === options.playMode);
  }

  return enriched;
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
