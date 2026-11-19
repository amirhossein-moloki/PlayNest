import { Address } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const AddressesRepo = {
  async findByGamingCenterId(gamingCenterId: string): Promise<Address[]> {
    const list = await prisma.address.findMany({
      where: { gamingCenterId },
      orderBy: { createdAt: 'desc' },
    });
    return list || [];
  },

  async findById(id: string): Promise<Address | null> {
    return prisma.address.findUnique({
      where: { id },
    });
  },

  async create(gamingCenterId: string, data: Record<string, unknown>): Promise<Address> {
    const { id: _id, addressId: _aid, createNew: _cn, ...createFields } = data;

    if (createFields.isPrimary === true) {
      await prisma.address.updateMany({
        where: { gamingCenterId },
        data: { isPrimary: false },
      });
    }

    return prisma.address.create({
      data: {
        ...createFields,
        gamingCenterId,
      } as never,
    });
  },

  async update(id: string, gamingCenterId: string, data: Record<string, unknown>): Promise<Address | null> {
    const { id: _id, addressId: _aid, createNew: _cn, ...updateFields } = data;

    if (updateFields.isPrimary === true) {
      await prisma.address.updateMany({
        where: { gamingCenterId, NOT: { id } },
        data: { isPrimary: false },
      });
    }

    const result = await prisma.address.updateMany({
      where: { id, gamingCenterId },
      data: updateFields,
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
