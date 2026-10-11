import { prisma } from '../../config/prisma';
import { CreateGamingCenterInput, UpdateGamingCenterInput } from './gamingCenter.types';
import { Prisma } from '@prisma/client';
import { ListGamingCentersQuery } from './gamingCenter.validation';
import { getPaginationParams, formatPaginatedResult } from '../../common/utils/pagination';

export const gamingCenterRepository = {
  async create(data: CreateGamingCenterInput) {
    return prisma.gamingCenter.create({
      data: data as Prisma.GamingCenterCreateInput,
    });
  },

  async findById(id: string) {
    return prisma.gamingCenter.findUnique({
      where: { id, isActive: true },
    });
  },

  async findBySlug(slug: string) {
    return prisma.gamingCenter.findUnique({
      where: { slug, isActive: true },
    });
  },

  async findAll(query: ListGamingCentersQuery) {
    const { page, limit, search, isActive, sortBy, sortOrder, city, game } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.GamingCenterWhereInput = {
      isActive: isActive !== undefined ? isActive : true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (city) {
      where.addresses = {
        some: {
          city: { contains: city, mode: 'insensitive' },
        },
      };
    }

    if (game) {
      where.games = {
        has: game,
      };
    }

    const [data, total] = await Promise.all([
      prisma.gamingCenter.findMany({
        where,
        skip,
        take,
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
        include: {
          addresses: true,
        },
      }),
      prisma.gamingCenter.count({ where }),
    ]);

    return formatPaginatedResult(data, total, page, limit);
  },

  async update(id: string, data: UpdateGamingCenterInput) {
    return prisma.gamingCenter.update({
      where: { id },
      data,
    });
  },

  async softDelete(id: string) {
    return prisma.gamingCenter.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
