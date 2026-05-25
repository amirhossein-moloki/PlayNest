import { prisma } from '../../config/prisma';
import { CreateSalonInput, UpdateSalonInput } from './gamingCenter.types';
import { Prisma } from '@prisma/client';
import { ListSalonsQuery } from './gamingCenter.validation';
import { getPaginationParams, formatPaginatedResult } from '../../common/utils/pagination';

export const salonRepository = {
  async create(data: CreateSalonInput) {
    return prisma.gamingCenter.create({
      data: data as Prisma.SalonCreateInput,
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

  async findAll(query: ListSalonsQuery) {
    const { page, limit, search, isActive, sortBy, sortOrder, city } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.SalonWhereInput = {
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

  async update(id: string, data: UpdateSalonInput) {
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
