import { prisma } from '../../config/prisma';
import { CreatePageInput, UpdatePageInput } from './pages.types';

export const pagesRepository = {
  async createPage(data: CreatePageInput, fullPath: string, depth: number) {
    return prisma.page.create({
      data: {
        ...data,
        fullPath,
        depth,
      },
    });
  },

  async findPageById(id: string, gamingCenterId: string) {
    return prisma.page.findFirst({
      where: { id, gamingCenterId, isActive: true },
    });
  },

  async findPageBySlug(slug: string, gamingCenterId: string) {
    return prisma.page.findFirst({
      where: { slug, gamingCenterId, isActive: true },
    });
  },

  async findPageByFullPath(fullPath: string, gamingCenterId: string) {
    return prisma.page.findFirst({
      where: { fullPath, gamingCenterId, isActive: true },
    });
  },

  async updatePage(id: string, data: UpdatePageInput & { fullPath?: string; depth?: number }) {
    return prisma.page.update({
      where: { id },
      data,
    });
  },

  async softDeletePage(id: string) {
    return prisma.page.update({
      where: { id },
      data: { isActive: false },
    });
  },

  async findAllPages(gamingCenterId: string, filter: Record<string, unknown>) {
    return prisma.page.findMany({
      where: {
        gamingCenterId,
        isActive: true,
        ...filter,
      },
      orderBy: { fullPath: 'asc' },
    });
  },

  async findChildren(parentId: string) {
    return prisma.page.findMany({
      where: { parentId, isActive: true },
    });
  },
};
