import { prisma } from '../../config/prisma';
import { Prisma, GamePlayMode } from '@prisma/client';
import {
  CreateDeviceCatalogInput,
  UpdateDeviceCatalogInput,
  ListDeviceCatalogQuery,
  CreateGameCatalogInput,
  UpdateGameCatalogInput,
  ListGameCatalogQuery,
  CreateDeviceTypeInput,
  UpdateDeviceTypeInput,
  ListDeviceTypeQuery,
} from './catalog.validator';
import { getPaginationParams, formatPaginatedResult } from '../../common/utils/pagination';

// ==========================================
// Device Type Repository (Dynamic Device Types)
// ==========================================

export async function createDeviceType(data: CreateDeviceTypeInput) {
  const generatedSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const slug = data.slug || generatedSlug || `device-type-${Date.now()}`;
  return prisma.deviceType.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      icon: data.icon,
      category: data.category,
      isActive: data.isActive ?? true,
      extraControllerEnabled: data.extraControllerEnabled ?? false,
    },
  });
}

export async function findDeviceTypeById(id: string) {
  return prisma.deviceType.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          deviceCatalogs: true,
          stations: true,
        },
      },
    },
  });
}

export async function findDeviceTypes(query: ListDeviceTypeQuery) {
  const { page, limit, search, isActive, sortBy, sortOrder, category, extraControllerEnabled } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where: Prisma.DeviceTypeWhereInput = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (extraControllerEnabled !== undefined) {
    where.extraControllerEnabled = extraControllerEnabled;
  }

  if (category) {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.deviceType.findMany({
      where,
      skip,
      take,
      orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            deviceCatalogs: true,
            stations: true,
          },
        },
      },
    }),
    prisma.deviceType.count({ where }),
  ]);

  return formatPaginatedResult(data, total, page, limit);
}

export async function updateDeviceType(id: string, data: UpdateDeviceTypeInput) {
  return prisma.deviceType.update({
    where: { id },
    data,
  });
}

export async function deleteDeviceType(id: string) {
  return prisma.deviceType.delete({
    where: { id },
  });
}

// ==========================================
// Device Catalog Repository
// ==========================================

export async function createDevice(data: CreateDeviceCatalogInput) {
  return prisma.deviceCatalog.create({
    data: {
      name: data.name,
      deviceType: data.deviceType,
      deviceTypeId: data.deviceTypeId,
      coverImageUrl: data.coverImageUrl,
      description: data.description,
      isActive: data.isActive ?? true,
    },
    include: {
      deviceTypeRef: true,
    },
  });
}

export async function findDeviceById(id: string) {
  return prisma.deviceCatalog.findUnique({
    where: { id },
    include: {
      deviceTypeRef: true,
    },
  });
}

export async function findDevices(query: ListDeviceCatalogQuery) {
  const { page, limit, search, isActive, sortBy, sortOrder, deviceType } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where: Prisma.DeviceCatalogWhereInput = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (deviceType) {
    where.deviceType = deviceType;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.deviceCatalog.findMany({
      where,
      skip,
      take,
      orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      include: {
        deviceTypeRef: true,
      },
    }),
    prisma.deviceCatalog.count({ where }),
  ]);

  return formatPaginatedResult(data, total, page, limit);
}

export async function updateDevice(id: string, data: UpdateDeviceCatalogInput) {
  return prisma.deviceCatalog.update({
    where: { id },
    data,
    include: {
      deviceTypeRef: true,
    },
  });
}

export async function deleteDevice(id: string) {
  return prisma.deviceCatalog.delete({
    where: { id },
  });
}

// ==========================================
// Game Catalog Repository
// ==========================================

export async function createGame(data: CreateGameCatalogInput) {
  return prisma.gameCatalog.create({
    data: {
      title: data.title,
      coverImageUrl: data.coverImageUrl,
      supportedPlatforms: data.supportedPlatforms,
      genre: data.genre,
      description: data.description,
      supportsOnline: data.supportsOnline ?? false,
      isActive: data.isActive ?? true,
    },
  });
}

export async function findGameById(id: string) {
  return prisma.gameCatalog.findUnique({
    where: { id },
  });
}

export async function findGames(query: ListGameCatalogQuery) {
  const { page, limit, search, isActive, sortBy, sortOrder, platform, genre, supportsOnline } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where: Prisma.GameCatalogWhereInput = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (supportsOnline !== undefined) {
    where.supportsOnline = supportsOnline;
  }

  if (platform) {
    where.supportedPlatforms = {
      has: platform,
    };
  }

  if (genre) {
    where.genre = { contains: genre, mode: 'insensitive' };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { genre: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.gameCatalog.findMany({
      where,
      skip,
      take,
      orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
    }),
    prisma.gameCatalog.count({ where }),
  ]);

  return formatPaginatedResult(data, total, page, limit);
}

export async function updateGame(id: string, data: UpdateGameCatalogInput) {
  if (data.supportsOnline === false && typeof prisma.$transaction === 'function') {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.gameCatalog.update({
        where: { id },
        data,
      });
      if (typeof tx.gamingCenterGame?.updateMany === 'function') {
        await tx.gamingCenterGame.updateMany({
          where: {
            gameCatalogId: id,
            playMode: GamePlayMode.ONLINE,
          },
          data: {
            playMode: GamePlayMode.OFFLINE,
          },
        });
      }
      return updated;
    });
  }

  return prisma.gameCatalog.update({
    where: { id },
    data,
  });
}

export async function deleteGame(id: string) {
  return prisma.gameCatalog.delete({
    where: { id },
  });
}
