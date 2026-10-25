import { SessionActorType } from '@prisma/client';
import { auditService } from '../audit/audit.station';
import * as StationRepo from './station.repo';
import { CreateStationInput, UpdateStationInput } from './station.types';
import { ListStationsQuery, CreateMaintenanceInput } from './station.validator';
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
 * Business logic to schedule a new maintenance window for a station.
 */
export async function createStationMaintenance(
  gamingCenterId: string,
  stationId: string,
  data: CreateMaintenanceInput,
  actor: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) {
  // 1. Ensure station exists within the gamingCenter
  await getStationById(stationId, gamingCenterId);

  const startTime = new Date(data.startTime);
  const endTime = data.endTime ? new Date(data.endTime) : null;

  // 2. Validate no active reservations overlap with requested maintenance
  const conflicts = await StationRepo.findOverlappingReservationsForMaintenance(
    gamingCenterId,
    stationId,
    startTime,
    endTime
  );

  if (conflicts.length > 0) {
    throw new AppError(
      'Cannot schedule maintenance: active reservation(s) exist during the requested period.',
      httpStatus.CONFLICT,
      {
        code: 'MAINTENANCE_CONFLICT_WITH_RESERVATION',
        details: { conflictingReservations: conflicts },
      }
    );
  }

  // 3. Create maintenance record
  const maintenance = await StationRepo.createMaintenance(stationId, {
    startTime,
    endTime,
    reason: data.reason,
    cost: data.cost,
  });

  // 4. Record audit event
  await auditService.log(
    gamingCenterId,
    actor,
    'STATION_MAINTENANCE_CREATE',
    { name: 'GameStation', id: stationId },
    { new: maintenance },
    context
  );

  return maintenance;
}

/**
 * Business logic to delete a maintenance record for a station.
 */
export async function deleteStationMaintenance(
  gamingCenterId: string,
  stationId: string,
  maintenanceId: string,
  actor: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) {
  // 1. Verify maintenance record exists and belongs to the gamingCenter/station
  const existing = await StationRepo.findMaintenanceById(maintenanceId, stationId);
  if (!existing || existing.station.gamingCenterId !== gamingCenterId) {
    throw new AppError('Station maintenance record not found', httpStatus.NOT_FOUND);
  }

  // 2. Delete maintenance record
  await StationRepo.deleteMaintenance(maintenanceId);

  // 3. Record audit event
  await auditService.log(
    gamingCenterId,
    actor,
    'STATION_MAINTENANCE_DELETE',
    { name: 'GameStation', id: stationId },
    { old: existing },
    context
  );

  return { success: true, message: 'Maintenance record removed.' };
}

/**
 * Business logic to retrieve maintenance records for a station.
 */
export async function getStationMaintenances(
  gamingCenterId: string,
  stationId: string,
  startDateStr?: string,
  endDateStr?: string
) {
  // Ensure station exists in this center
  await getStationById(stationId, gamingCenterId);

  const startDate = startDateStr ? new Date(startDateStr) : undefined;
  const endDate = endDateStr ? new Date(endDateStr) : undefined;

  return StationRepo.findMaintenancesByStationId(stationId, gamingCenterId, startDate, endDate);
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
