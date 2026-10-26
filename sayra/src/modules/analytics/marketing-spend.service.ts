import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export interface CreateMarketingSpendInput {
  gamingCenterId?: string | null;
  campaignId?: string | null;
  campaignName: string;
  source: string;
  medium?: string | null;
  amount: number;
  currency?: string;
  startDate: Date;
  endDate: Date;
}

export const MarketingSpendService = {
  async createMarketingSpend(input: CreateMarketingSpendInput) {
    if (input.amount <= 0) {
      throw new AppError('Marketing spend amount must be greater than zero.', httpStatus.BAD_REQUEST);
    }

    if (input.endDate < input.startDate) {
      throw new AppError('End date cannot be before start date.', httpStatus.BAD_REQUEST);
    }

    const spend = await prisma.marketingCampaignSpend.create({
      data: {
        gamingCenterId: input.gamingCenterId || null,
        campaignId: input.campaignId || null,
        campaignName: input.campaignName,
        source: input.source.toLowerCase(),
        medium: input.medium ? input.medium.toLowerCase() : null,
        amount: input.amount,
        currency: input.currency || 'IRR',
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });

    return spend;
  },

  async getMarketingSpends(gamingCenterId: string, startDate?: Date, endDate?: Date) {
    const where: any = {
      OR: [{ gamingCenterId }, { gamingCenterId: null }],
    };

    if (startDate || endDate) {
      where.startDate = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const spends = await prisma.marketingCampaignSpend.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });

    const totalAmount = spends.reduce((acc, s) => acc + s.amount, 0);

    return {
      spends,
      totalAmount,
      count: spends.length,
    };
  },
};
