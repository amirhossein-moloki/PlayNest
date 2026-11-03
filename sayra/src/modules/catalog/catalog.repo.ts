import { prisma } from '../../config/prisma';
import { Prisma } from '@prisma/client';
import {
  CreateDeviceCatalogInput,
  UpdateDeviceCatalogInput,
  ListDeviceCatalogQuery,
  CreateGameCatalogInput,
  UpdateGameCatalogInput,
  ListGameCatalogQuery,
} from './catalog.validator';
import { getPaginationParams, formatPaginatedResult } from '../../common/utils/pagination';

// ==========================================
// Device Catalog Repository
// ==========================================

export async function createDevice(data: CreateDeviceCatalogInput) {
  return prisma.deviceCatalog.create({
    data: {
      name: data.name,
      deviceType: data.deviceType,
      coverImageUrl: data.coverImageUrl,
      description: data.description,
      isActive: data.isActive ?? true,
    },
  });
}

export async function findDeviceById(id: string) {
  return prisma.deviceCatalog.findUnique({
    where: { id },
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
    }),
    prisma.deviceCatalog.count({ where }),
  ]);

  return formatPaginatedResult(data, total, page, limit);
}

export async function updateDevice(id: string, data: UpdateDeviceCatalogInput) {
  return prisma.deviceCatalog.update({
    where: { id },
    data,
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
  const { page, limit, search, isActive, sortBy, sortOrder, platform, genre } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where: Prisma.GameCatalogWhereInput = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
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
