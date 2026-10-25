import { prisma } from '../../config/prisma';
import { CreateStationInput, UpdateStationInput } from './station.types';
import { Prisma } from '@prisma/client';
import { ListStationsQuery } from './station.validator';
import { getPaginationParams, formatPaginatedResult } from '../../common/utils/pagination';

/**
 * Creates a new station for a given gamingCenter.
 * @param gamingCenterId - The ID of the gamingCenter.
 * @param data - The data for the new station.
 * @returns The newly created station.
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
 * Finds a station by its ID for a specific gamingCenter.
 * @param stationId - The ID of the station to find.
 * @param gamingCenterId - The ID of the gamingCenter.
 * @returns The station if found, otherwise null.
 */
export async function findStationById(stationId: string, gamingCenterId: string) {
  return prisma.gameStation.findFirst({
    where: { id: stationId, gamingCenterId },
  });
}

/**
 * Retrieves a list of stations for a given gamingCenter, with optional filtering.
 * @param gamingCenterId - The ID of the gamingCenter.
 * @param options - Optional filtering criteria (e.g., isActive).
 * @returns A list of stations.
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
    stationType,
    isVip,
    staffId,
  } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where: Prisma.GameStationWhereInput = {
    gamingCenterId,
    isActive: isActive !== undefined ? isActive : true,
    stationType,
    isVip,
  };

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.hourlyPrice = {
      gte: minPrice,
      lte: maxPrice,
    };
  }

  if (staffId) {
    where.staffSkills = {
      some: {
        userId: staffId,
      },
    };
  }

  const [data, total] = await Promise.all([
    prisma.gameStation.findMany({
      where,
      skip,
      take,
      orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
    }),
    prisma.gameStation.count({ where }),
  ]);

  return formatPaginatedResult(data, total, page, limit);
}

/**
 * Updates an existing station for a specific gamingCenter.
 * @param stationId - The ID of the station to update.
 * @param gamingCenterId - The ID of the gamingCenter.
 * @param data - The data to update the station with.
 * @returns The updated station.
 */
export async function updateStation(stationId: string, gamingCenterId: string, data: UpdateStationInput) {
  // Use updateMany to ensure we are only updating a station belonging to the correct gamingCenter.
  await prisma.gameStation.updateMany({
    where: { id: stationId, gamingCenterId },
    data,
  });

  // Return the updated station record.
  return findStationById(stationId, gamingCenterId);
}

/**
 * Deactivates a station (soft delete) for a specific gamingCenter.
 * @param stationId - The ID of the station to deactivate.
 * @param gamingCenterId - The ID of the gamingCenter.
 * @returns The deactivated station.
 */
export async function deactivateStation(stationId: string, gamingCenterId: string) {
  await prisma.gameStation.updateMany({
    where: { id: stationId, gamingCenterId },
    data: { isActive: false },
  });
  return findStationById(stationId, gamingCenterId);
}

/**
 * Creates a new maintenance record for a station.
 */
export async function createMaintenance(
  stationId: string,
  data: { startTime: Date; endTime?: Date | null; reason: string; cost?: number | null }
) {
  return prisma.stationMaintenance.create({
    data: {
      stationId,
      startTime: data.startTime,
      endTime: data.endTime,
      reason: data.reason,
      cost: data.cost,
    },
    include: {
      station: {
        select: { id: true, name: true, stationType: true },
      },
    },
  });
}

/**
 * Deletes a maintenance record.
 */
export async function deleteMaintenance(maintenanceId: string) {
  return prisma.stationMaintenance.delete({
    where: { id: maintenanceId },
  });
}

/**
 * Finds a maintenance record by ID and optionally checks stationId.
 */
export async function findMaintenanceById(maintenanceId: string, stationId?: string) {
  return prisma.stationMaintenance.findFirst({
    where: {
      id: maintenanceId,
      ...(stationId ? { stationId } : {}),
    },
    include: {
      station: {
        select: { id: true, gamingCenterId: true },
      },
    },
  });
}

/**
 * Retrieves maintenance windows for a station.
 */
export async function findMaintenancesByStationId(
  stationId: string,
  gamingCenterId: string,
  startDate?: Date,
  endDate?: Date
) {
  return prisma.stationMaintenance.findMany({
    where: {
      stationId,
      station: { gamingCenterId },
      ...(startDate || endDate
        ? {
            AND: [
              startDate ? { OR: [{ endTime: null }, { endTime: { gte: startDate } }] } : {},
              endDate ? { startTime: { lte: endDate } } : {},
            ],
          }
        : {}),
    },
    orderBy: { startTime: 'desc' },
    include: {
      station: {
        select: { id: true, name: true, stationType: true },
      },
    },
  });
}

/**
 * Finds any active reservations that overlap with a proposed maintenance window.
 */
export async function findOverlappingReservationsForMaintenance(
  gamingCenterId: string,
  stationId: string,
  startTime: Date,
  endTime?: Date | null
) {
  const now = new Date();

  const activeStatusConditions: Prisma.ReservationWhereInput[] = [
    { status: { in: ['CONFIRMED', 'IN_PROGRESS'] } },
    {
      status: 'PENDING',
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  ];

  const timeOverlapCondition: Prisma.ReservationWhereInput = endTime
    ? {
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      }
    : {
        endTime: { gt: startTime },
      };

  return prisma.reservation.findMany({
    where: {
      gamingCenterId,
      stationId,
      OR: activeStatusConditions,
      AND: [timeOverlapCondition],
    },
    select: {
      id: true,
      status: true,
      startTime: true,
      endTime: true,
      customerAccountId: true,
    },
  });
}
