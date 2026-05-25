import { SocialLink } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const LinksRepo = {
  async findBySalonId(gamingCenterId: string): Promise<SocialLink[]> {
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

  async create(gamingCenterId: string, data: any): Promise<SocialLink> {
    return prisma.socialLink.create({
      data: {
        ...data,
        gamingCenterId,
      },
    });
  },

  async update(id: string, data: any): Promise<SocialLink> {
    return prisma.socialLink.update({
      where: { id },
      data,
    });
  },

  async delete(id: string): Promise<SocialLink> {
    return prisma.socialLink.delete({
      where: { id },
    });
  },
};
