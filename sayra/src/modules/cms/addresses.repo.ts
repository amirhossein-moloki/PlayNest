import { Address } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const AddressesRepo = {
  async findByGamingCenterId(gamingCenterId: string): Promise<Address[]> {
    return prisma.address.findMany({
      where: { gamingCenterId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: string): Promise<Address | null> {
    return prisma.address.findUnique({
      where: { id },
    });
  },

  async create(gamingCenterId: string, data: Record<string, unknown>): Promise<Address> {
    return prisma.address.create({
      data: {
        ...data,
        gamingCenterId,
      } as never,
    });
  },

  async update(id: string, gamingCenterId: string, data: Record<string, unknown>): Promise<Address | null> {
    const result = await prisma.address.updateMany({
      where: { id, gamingCenterId },
      data,
    });
    if (result.count === 0) return null;
    return prisma.address.findUnique({ where: { id } });
  },

  async delete(id: string, gamingCenterId: string): Promise<boolean> {
    const result = await prisma.address.deleteMany({
      where: { id, gamingCenterId },
    });
    return result.count > 0;
  },
};
