import { SessionActorType } from '@prisma/client';
import { auditService } from '../audit/audit.station';
import * as StationRepo from './station.repo';
import { CreateStationInput, UpdateStationInput } from './station.types';
import { ListStationsQuery } from './station.validator';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

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
