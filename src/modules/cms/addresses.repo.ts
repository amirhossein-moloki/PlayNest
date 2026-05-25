import { Address } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const AddressesRepo = {
  async findBySalonId(gamingCenterId: string): Promise<Address[]> {
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

  async create(gamingCenterId: string, data: any): Promise<Address> {
    return prisma.address.create({
      data: {
        ...data,
        gamingCenterId,
      },
    });
  },

  async update(id: string, data: any): Promise<Address> {
    return prisma.address.update({
      where: { id },
      data,
    });
  },

  async delete(id: string): Promise<Address> {
    return prisma.address.delete({
      where: { id },
    });
  },
};
