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
    type,
    isVip,
    staffId,
    ids,
    fields,
  } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const resolvedStationType = stationType || type;

  const where: Prisma.GameStationWhereInput = {
    gamingCenterId,
    isActive: isActive !== undefined ? isActive : true,
    ...(resolvedStationType ? { stationType: resolvedStationType } : {}),
    ...(isVip !== undefined ? { isVip } : {}),
  };

  if (ids && ids.length > 0) {
    where.id = { in: ids };
  }

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
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
