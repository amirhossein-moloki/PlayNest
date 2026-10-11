import { SocialLink } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const LinksRepo = {
  async findByGamingCenterId(gamingCenterId: string): Promise<SocialLink[]> {
    return prisma.socialLink.findMany({
      where: { gamingCenterId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: string): Promise<SocialLink | null> {
    return prisma.socialLink.findUnique({
      where: { id },
    });
  },

  async create(gamingCenterId: string, data: Record<string, unknown>): Promise<SocialLink> {
    return prisma.socialLink.create({
      data: {
        ...data,
        gamingCenterId,
      } as never,
    });
  },

  async update(id: string, gamingCenterId: string, data: Record<string, unknown>): Promise<SocialLink | null> {
    const result = await prisma.socialLink.updateMany({
      where: { id, gamingCenterId },
      data,
    });
    if (result.count === 0) return null;
    return prisma.socialLink.findUnique({ where: { id } });
  },

  async delete(id: string, gamingCenterId: string): Promise<boolean> {
    const result = await prisma.socialLink.deleteMany({
      where: { id, gamingCenterId },
    });
    return result.count > 0;
  },
};
