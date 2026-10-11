import { Prisma, Discount } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const DiscountsRepo = {
  async createDiscount(
    data: Prisma.DiscountUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<Discount> {
    const client = tx || prisma;
    return client.discount.create({ data });
  },

  async findById(
    id: string,
    gamingCenterId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Discount | null> {
    const client = tx || prisma;
    return client.discount.findFirst({
      where: { id, gamingCenterId },
    });
  },

  async updateDiscount(
    id: string,
    gamingCenterId: string,
    data: Prisma.DiscountUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<Discount> {
    const client = tx || prisma;
    return client.discount.update({
      where: { id },
      data,
    });
  },

  async deleteDiscount(
    id: string,
    gamingCenterId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Discount> {
    const client = tx || prisma;
    return client.discount.delete({
      where: { id },
    });
  },

  async findMany(
    where: Prisma.DiscountWhereInput,
    skip?: number,
    take?: number,
    orderBy: Prisma.DiscountOrderByWithRelationInput = { createdAt: 'desc' },
    tx?: Prisma.TransactionClient
  ): Promise<Discount[]> {
    const client = tx || prisma;
    return client.discount.findMany({
      where,
      skip,
      take,
      orderBy,
    });
  },

  async count(
    where: Prisma.DiscountWhereInput,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx || prisma;
    return client.discount.count({ where });
  },

  async findActiveApplicableDiscounts(
    gamingCenterId: string,
    stationId: string,
    atTime: Date = new Date(),
    tx?: Prisma.TransactionClient
  ): Promise<Discount[]> {
    const client = tx || prisma;
    return client.discount.findMany({
      where: {
        gamingCenterId,
        isActive: true,
        startAt: { lte: atTime },
        endAt: { gte: atTime },
        OR: [
          { targetType: 'GAMING_CENTER', targetId: gamingCenterId },
          { targetType: 'STATION', targetId: stationId },
        ],
      },
    });
  },
};
