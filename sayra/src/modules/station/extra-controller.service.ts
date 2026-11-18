import { BookingHoldStatus, GameStationType, Prisma, ReservationStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export interface ExtraControllerSelectionInput {
  extraControllerId: string;
  quantity: number;
}

export interface PricedExtraControllerItem {
  extraControllerId: string;
  controllerType: string;
  quantity: number;
  hourlyPrice: number;
  totalCost: number;
}

export interface ExtraControllerConfigInput {
  controllerType: string;
  quantity: number;
  hourlyPrice: number;
  isActive?: boolean;
}

const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.IN_PROGRESS,
];

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Resolves whether extra controllers are enabled for a station's DeviceType.
 */
export async function isExtraControllerSupportedForStation(
  stationId: string,
  client: DbClient = prisma
): Promise<boolean> {
  const station = await client.gameStation.findUnique({
    where: { id: stationId },
    select: {
      stationType: true,
      deviceTypeId: true,
      deviceTypeRef: { select: { extraControllerEnabled: true } },
      catalogDevice: {
        select: {
          deviceTypeRef: { select: { extraControllerEnabled: true } },
        },
      },
    },
  });

  if (!station) return false;

  if (station.deviceTypeRef) {
    return station.deviceTypeRef.extraControllerEnabled;
  }

  if (station.catalogDevice?.deviceTypeRef) {
    return station.catalogDevice.deviceTypeRef.extraControllerEnabled;
  }

  const matchingDeviceType = await client.deviceType.findFirst({
    where: {
      category: station.stationType as GameStationType,
      isActive: true,
      extraControllerEnabled: true,
    },
    select: { id: true },
  });

  return Boolean(matchingDeviceType);
}

/**
 * Computes how many units of a StationExtraController are already reserved in [startTime, endTime].
 */
export async function getReservedControllerQuantity(
  extraControllerId: string,
  startTime: Date,
  endTime: Date,
  client: DbClient = prisma,
  excludeReservationId?: string
): Promise<number> {
  const now = new Date();

  const [reservationAgg, holdAgg] = await Promise.all([
    client.reservationExtraController.aggregate({
      where: {
        extraControllerId,
        reservation: {
          ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
          status: { in: ACTIVE_RESERVATION_STATUSES },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      },
      _sum: { quantity: true },
    }),
    client.bookingHoldExtraController.aggregate({
      where: {
        extraControllerId,
        bookingHoldItem: {
          bookingHold: {
            status: BookingHoldStatus.ACTIVE,
            expiresAt: { gt: now },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        },
      },
      _sum: { quantity: true },
    }),
  ]);

  return (reservationAgg._sum.quantity ?? 0) + (holdAgg._sum.quantity ?? 0);
}

/**
 * Lists extra controller configurations for a station, optionally computing live availableQuantity for a time window.
 */
export async function getStationExtraControllers(
  stationId: string,
  options?: {
    gamingCenterId?: string;
    startTime?: Date;
    endTime?: Date;
    activeOnly?: boolean;
  },
  client: DbClient = prisma
) {
  const supported = await isExtraControllerSupportedForStation(stationId, client);
  if (options?.activeOnly && !supported) {
    return [];
  }

  const configs = await client.stationExtraController.findMany({
    where: {
      stationId,
      ...(options?.gamingCenterId ? { gamingCenterId: options.gamingCenterId } : {}),
      ...(options?.activeOnly ? { isActive: true, quantity: { gt: 0 } } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });

  if (configs.length === 0) return [];

  const results = await Promise.all(
    configs.map(async (cfg) => {
      let availableQuantity = cfg.quantity;
      if (options?.startTime && options?.endTime) {
        const reserved = await getReservedControllerQuantity(
          cfg.id,
          options.startTime,
          options.endTime,
          client
        );
        availableQuantity = Math.max(0, cfg.quantity - reserved);
      }

      return {
        ...cfg,
        availableQuantity,
      };
    })
  );

  if (options?.activeOnly) {
    return results.filter((r) => r.availableQuantity > 0);
  }

  return results;
}

/**
 * Validates requested extra controllers against DeviceType support and live inventory,
 * and calculates backend-authoritative pricing.
 * Should be called inside a transaction with the station row locked FOR UPDATE.
 */
export async function validateAndPriceExtraControllers(
  stationId: string,
  startTime: Date,
  endTime: Date,
  durationHours: number,
  selections: ExtraControllerSelectionInput[] | undefined,
  client: DbClient = prisma,
  excludeReservationId?: string
): Promise<{ items: PricedExtraControllerItem[]; totalCost: number }> {
  if (!selections || selections.length === 0) {
    return { items: [], totalCost: 0 };
  }

  const supported = await isExtraControllerSupportedForStation(stationId, client);
  if (!supported) {
    throw new AppError(
      'Extra controllers are not enabled for this device type.',
      httpStatus.BAD_REQUEST,
      { code: 'EXTRA_CONTROLLER_NOT_SUPPORTED' }
    );
  }

  // Merge duplicate extraControllerIds if any
  const merged = new Map<string, number>();
  for (const sel of selections) {
    if (!Number.isInteger(sel.quantity) || sel.quantity <= 0) {
      throw new AppError(
        'Extra controller quantity must be a positive integer.',
        httpStatus.BAD_REQUEST,
        { code: 'INVALID_CONTROLLER_QUANTITY' }
      );
    }
    merged.set(sel.extraControllerId, (merged.get(sel.extraControllerId) ?? 0) + sel.quantity);
  }

  const items: PricedExtraControllerItem[] = [];
  let totalCost = 0;

  for (const [extraControllerId, quantity] of merged.entries()) {
    const config = await client.stationExtraController.findFirst({
      where: {
        id: extraControllerId,
        stationId,
        isActive: true,
      },
    });

    if (!config) {
      throw new AppError(
        `Extra controller configuration ${extraControllerId} is not available for this station.`,
        httpStatus.BAD_REQUEST,
        { code: 'EXTRA_CONTROLLER_NOT_FOUND' }
      );
    }

    if (config.hourlyPrice < 0 || config.quantity < 0) {
      throw new AppError(
        'Invalid extra controller pricing or inventory configuration.',
        httpStatus.BAD_REQUEST,
        { code: 'INVALID_CONTROLLER_CONFIG' }
      );
    }

    const alreadyReserved = await getReservedControllerQuantity(
      config.id,
      startTime,
      endTime,
      client,
      excludeReservationId
    );
    const remainingAvailable = Math.max(0, config.quantity - alreadyReserved);

    if (quantity > remainingAvailable) {
      throw new AppError(
        `Insufficient inventory for ${config.controllerType}. Requested ${quantity}, available ${remainingAvailable}.`,
        httpStatus.CONFLICT,
        { code: 'INSUFFICIENT_CONTROLLER_INVENTORY' }
      );
    }

    const itemTotalCost = quantity * config.hourlyPrice * durationHours;
    totalCost += itemTotalCost;

    items.push({
      extraControllerId: config.id,
      controllerType: config.controllerType,
      quantity,
      hourlyPrice: config.hourlyPrice,
      totalCost: itemTotalCost,
    });
  }

  return { items, totalCost };
}

/**
 * Asserts that a station belongs to the gaming center and its DeviceType supports extra controllers.
 */
/**
 * Asserts that a station belongs to the gaming center and its DeviceType supports extra controllers.
 */
async function assertManagerStationSupportsExtraControllers(
  stationId: string,
  gamingCenterId?: string,
  client: DbClient = prisma
): Promise<{ id: string; gamingCenterId?: string }> {
  const station = await client.gameStation.findFirst({
    where: {
      id: stationId,
      ...(gamingCenterId ? { gamingCenterId } : {}),
    },
    select: { id: true, gamingCenterId: true },
  });

  if (!station) {
    throw new AppError('GameStation not found.', httpStatus.NOT_FOUND);
  }

  const supported = await isExtraControllerSupportedForStation(stationId, client);
  if (!supported) {
    throw new AppError(
      'Extra controllers are not enabled for this device type by the platform administrator.',
      httpStatus.BAD_REQUEST,
      { code: 'EXTRA_CONTROLLER_NOT_SUPPORTED' }
    );
  }

  return station;
}

export async function replaceStationExtraControllers(
  stationId: string,
  gamingCenterId?: string,
  configs: ExtraControllerConfigInput[] = [],
  client: DbClient = prisma
) {
  let resolvedGamingCenterId = gamingCenterId;

  if (configs.length > 0) {
    const station = await assertManagerStationSupportsExtraControllers(stationId, resolvedGamingCenterId, client);
    resolvedGamingCenterId = resolvedGamingCenterId || station.gamingCenterId;
  } else {
    const station = await client.gameStation.findFirst({
      where: {
        id: stationId,
        ...(resolvedGamingCenterId ? { gamingCenterId: resolvedGamingCenterId } : {}),
      },
      select: { id: true, gamingCenterId: true },
    });
    if (!station) {
      throw new AppError('GameStation not found.', httpStatus.NOT_FOUND);
    }
    resolvedGamingCenterId = resolvedGamingCenterId || station.gamingCenterId;
  }

  if (!resolvedGamingCenterId) {
    const station = await client.gameStation.findUnique({
      where: { id: stationId },
      select: { gamingCenterId: true },
    });
    resolvedGamingCenterId = station?.gamingCenterId;
  }

  const run = async (tx: Prisma.TransactionClient) => {
    await tx.stationExtraController.deleteMany({
      where: {
        stationId,
        ...(resolvedGamingCenterId ? { gamingCenterId: resolvedGamingCenterId } : {}),
      },
    });

    if (configs.length === 0) return [];

    const created = [];
    for (const cfg of configs) {
      const row = await tx.stationExtraController.create({
        data: {
          stationId,
          gamingCenterId: resolvedGamingCenterId!,
          controllerType: cfg.controllerType.trim(),
          quantity: cfg.quantity,
          hourlyPrice: cfg.hourlyPrice,
          isActive: cfg.isActive ?? true,
        },
      });
      created.push(row);
    }
    return created;
  };

  if (client !== prisma) {
    return run(client as Prisma.TransactionClient);
  }
  return prisma.$transaction(run);
}

export async function addStationExtraController(
  stationId: string,
  gamingCenterId: string | undefined,
  data: ExtraControllerConfigInput
) {
  const station = await assertManagerStationSupportsExtraControllers(stationId, gamingCenterId);
  const resolvedGamingCenterId = gamingCenterId || station.gamingCenterId;

  return prisma.stationExtraController.create({
    data: {
      stationId,
      gamingCenterId: resolvedGamingCenterId!,
      controllerType: data.controllerType.trim(),
      quantity: data.quantity,
      hourlyPrice: data.hourlyPrice,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateStationExtraController(
  stationId: string,
  gamingCenterId: string | undefined,
  extraControllerId: string,
  data: Partial<ExtraControllerConfigInput>
) {
  const station = await assertManagerStationSupportsExtraControllers(stationId, gamingCenterId);
  const resolvedGamingCenterId = gamingCenterId || station.gamingCenterId;

  const existing = await prisma.stationExtraController.findFirst({
    where: {
      id: extraControllerId,
      stationId,
      ...(resolvedGamingCenterId ? { gamingCenterId: resolvedGamingCenterId } : {}),
    },
  });
  if (!existing) {
    throw new AppError('Extra controller configuration not found.', httpStatus.NOT_FOUND);
  }

  return prisma.stationExtraController.update({
    where: { id: extraControllerId },
    data: {
      ...(data.controllerType !== undefined ? { controllerType: data.controllerType.trim() } : {}),
      ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
      ...(data.hourlyPrice !== undefined ? { hourlyPrice: data.hourlyPrice } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
}

export async function deleteStationExtraController(
  stationId: string,
  gamingCenterId: string | undefined,
  extraControllerId: string
) {
  const existing = await prisma.stationExtraController.findFirst({
    where: {
      id: extraControllerId,
      stationId,
      ...(gamingCenterId ? { gamingCenterId } : {}),
    },
  });
  if (!existing) {
    throw new AppError('Extra controller configuration not found.', httpStatus.NOT_FOUND);
  }

  return prisma.stationExtraController.delete({
    where: { id: extraControllerId },
  });
}
