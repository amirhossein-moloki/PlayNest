import { prisma } from '../../config/prisma';
import { CreateCategoryInput, UpdateCategoryInput, CreateTagInput, UpdateTagInput } from './taxonomy.types';
import { Prisma } from '@prisma/client';
import { ListTaxonomyQuery } from './taxonomy.validation';
import { getPaginationParams, formatPaginatedResult } from '../../common/utils/pagination';

export const taxonomyRepository = {
  // --- Category Operations ---
  async createCategory(data: CreateCategoryInput) {
    return prisma.category.create({
      data,
    });
  },

  async findCategoryById(id: string, gamingCenterId: string) {
    return prisma.category.findFirst({
      where: { id, gamingCenterId, isActive: true },
    });
  },

  async findCategoryBySlug(slug: string, gamingCenterId: string) {
    return prisma.category.findUnique({
      where: { gamingCenterId_slug: { slug, gamingCenterId } },
    });
  },

  async findAllCategories(gamingCenterId: string, query: ListTaxonomyQuery) {
    const { page, limit, search, isActive } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.CategoryWhereInput = {
      gamingCenterId,
      isActive: isActive !== undefined ? isActive : true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        include: {
          parent: true,
          children: true,
        },
      }),
      prisma.category.count({ where }),
    ]);

    return formatPaginatedResult(data, total, page, limit);
  },

  async updateCategory(id: string, data: UpdateCategoryInput) {
    return prisma.category.update({
      where: { id },
      data,
    });
  },

  async softDeleteCategory(id: string) {
    return prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  },

  // --- Tag Operations ---
  async createTag(data: CreateTagInput) {
    return prisma.tag.create({
      data,
    });
  },

  async findTagById(id: string, gamingCenterId: string) {
    return prisma.tag.findFirst({
      where: { id, gamingCenterId, isActive: true },
    });
  },

  async findTagBySlug(slug: string, gamingCenterId: string) {
    return prisma.tag.findUnique({
      where: { gamingCenterId_slug: { slug, gamingCenterId } },
    });
  },

  async findAllTags(gamingCenterId: string, query: ListTaxonomyQuery) {
    const { page, limit, search, isActive } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.TagWhereInput = {
      gamingCenterId,
      isActive: isActive !== undefined ? isActive : true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.tag.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      prisma.tag.count({ where }),
    ]);

    return formatPaginatedResult(data, total, page, limit);
  },

  async updateTag(id: string, data: UpdateTagInput) {
    return prisma.tag.update({
      where: { id },
      data,
    });
  },

  async softDeleteTag(id: string) {
    return prisma.tag.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
