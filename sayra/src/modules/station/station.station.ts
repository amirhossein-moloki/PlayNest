import { SessionActorType } from '@prisma/client';
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
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

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
      catalogDeviceId: catalogDevice.id,
      coverImageUrl: catalogDevice.coverImageUrl,
      hourlyPrice: input.hourlyPrice,
      isVip: input.isVip ?? false,
      minRentHours: input.minRentHours ?? 1,
      maxRentHours: input.maxRentHours ?? 8,
      defaultDurationHours: input.defaultDurationHours ?? 1,
      incrementMinutes: input.incrementMinutes ?? 30,
      isActive: true,
    });
  }

  const createdStations = await StationRepo.createManyStations(gamingCenterId, stationsToCreate);

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

/**
 * Business logic to add games from GameCatalog into GamingCenter's games list.
 */
export async function addGamesFromCatalog(
  gamingCenterId: string,
  input: AddGamesFromCatalogInput,
  actor?: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) {
  const games = await prisma.gameCatalog.findMany({
    where: {
      id: { in: input.gameCatalogIds },
    },
  });

  if (games.length === 0) {
    throw new AppError('No matching games found in catalog', httpStatus.NOT_FOUND);
  }

  const center = await prisma.gamingCenter.findUnique({
    where: { id: gamingCenterId },
    select: { games: true },
  });

  if (!center) {
    throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
  }

  const existingGameTitles = new Set(center.games || []);
  const newTitles = games.map((g) => g.title).filter((title) => !existingGameTitles.has(title));

  const updatedGames = [...(center.games || []), ...newTitles];

  const updatedCenter = await prisma.gamingCenter.update({
    where: { id: gamingCenterId },
    data: { games: updatedGames },
    select: { id: true, name: true, games: true },
  });

  if (actor) {
    await auditService.log(
      gamingCenterId,
      actor,
      'GAMING_CENTER_ADD_GAMES_FROM_CATALOG',
      { name: 'GamingCenter', id: gamingCenterId },
      { old: { games: center.games }, new: { games: updatedGames, added: newTitles } },
      context
    );
  }

  return {
    gamingCenterId,
    addedGames: newTitles,
    allGames: updatedCenter.games,
  };
}

/**
 * Business logic to create a new station.
 * @param gamingCenterId - The ID of the gamingCenter.
 * @param data - The data for the new station.
 * @returns The newly created station.
 */
export async function createStation(gamingCenterId: string, data: CreateStationInput) {
  // In a real app, you might have more complex logic here,
  // e.g., checking for duplicate station names within the same gamingCenter.
  return StationRepo.createStation(gamingCenterId, data);
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
  return station;
}

/**
 * Business logic to get all stations for a gamingCenter.
 * @param gamingCenterId - The ID of the gamingCenter.
 * @param query - Filtering and pagination criteria.
 * @returns A list of stations.
 */
export async function getStationsForGamingCenter(gamingCenterId: string, query: ListStationsQuery) {
  return StationRepo.findStationsByGamingCenterId(gamingCenterId, query);
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
  const updatedStation = await StationRepo.updateStation(stationId, gamingCenterId, data);

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
