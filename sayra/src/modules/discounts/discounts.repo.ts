import { Prisma, Discount, DiscountCampaign, DiscountUsage } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const DiscountsRepo = {
  // Campaign methods
  async createCampaign(
    data: Prisma.DiscountCampaignUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<DiscountCampaign> {
    const client = tx || prisma;
    return client.discountCampaign.create({ data });
  },

  async findCampaignById(
    id: string,
    gamingCenterId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<DiscountCampaign | null> {
    const client = tx || prisma;
    const where: Prisma.DiscountCampaignWhereInput = { id };
    if (gamingCenterId) {
      where.OR = [
        { gamingCenterId },
        { gamingCenterId: null },
      ];
    }
    return client.discountCampaign.findFirst({ where });
  },

  async findCampaignByCode(
    code: string,
    gamingCenterId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<DiscountCampaign | null> {
    const client = tx || prisma;
    const where: Prisma.DiscountCampaignWhereInput = {
      code: { equals: code, mode: 'insensitive' },
      isActive: true,
    };
    if (gamingCenterId) {
      where.OR = [
        { gamingCenterId },
        { gamingCenterId: null },
      ];
    }
    return client.discountCampaign.findFirst({ where });
  },

  async findCampaignByCodeForUpdate(
    code: string,
    gamingCenterId: string,
    tx: Prisma.TransactionClient
  ): Promise<DiscountCampaign | null> {
    // Acquire row-level lock via RAW query to prevent concurrent double-spend/over-budget
    const results = await tx.$queryRaw<DiscountCampaign[]>`
      SELECT * FROM "DiscountCampaign"
      WHERE LOWER("code") = LOWER(${code})
        AND "isActive" = true
        AND ("gamingCenterId" = ${gamingCenterId} OR "gamingCenterId" IS NULL)
      FOR UPDATE
    `;
    return results[0] || null;
  },

  async updateCampaign(
    id: string,
    data: Prisma.DiscountCampaignUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<DiscountCampaign> {
    const client = tx || prisma;
    return client.discountCampaign.update({
      where: { id },
      data,
    });
  },

  async findManyCampaigns(
    where: Prisma.DiscountCampaignWhereInput,
    skip?: number,
    take?: number,
    orderBy: Prisma.DiscountCampaignOrderByWithRelationInput = { createdAt: 'desc' },
    tx?: Prisma.TransactionClient
  ): Promise<DiscountCampaign[]> {
    const client = tx || prisma;
    return client.discountCampaign.findMany({
      where,
      skip,
      take,
      orderBy,
    });
  },

  async countCampaigns(
    where: Prisma.DiscountCampaignWhereInput,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx || prisma;
    return client.discountCampaign.count({ where });
  },

  async countUserCampaignUsages(
    campaignId: string,
    customerAccountId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx || prisma;
    return client.discountUsage.count({
      where: { campaignId, customerAccountId },
    });
  },

  async createDiscountUsage(
    data: Prisma.DiscountUsageUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<DiscountUsage> {
    const client = tx || prisma;
    return client.discountUsage.create({ data });
  },

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
