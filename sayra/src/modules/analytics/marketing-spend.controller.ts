import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { MarketingSpendService } from './marketing-spend.service';
import { AnalyticsStation } from './analytics.station';
import { AnalyticsQuery } from './analytics.validators';

const createMarketingSpend = asyncHandler(async (req: AppRequest, res: Response) => {
  const { campaignId, campaignName, source, medium, amount, currency, startDate, endDate } = req.body;

  const result = await MarketingSpendService.createMarketingSpend({
    gamingCenterId: req.tenant.gamingCenterId,
    campaignId,
    campaignName,
    source,
    medium,
    amount: Number(amount),
    currency,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });

  res.created(result);
});

const getMarketingSpends = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

  const result = await MarketingSpendService.getMarketingSpends(
    req.tenant.gamingCenterId,
    startDate ? new Date(startDate) : undefined,
    endDate ? new Date(endDate) : undefined
  );

  res.ok(result);
});

const getMarketingAttributionAnalytics = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;

  const result = await AnalyticsStation.getMarketingAttributionAnalytics(
    req.tenant.gamingCenterId,
    startDate,
    endDate
  );

  res.ok(result);
});

export const MarketingSpendController = {
  createMarketingSpend,
  getMarketingSpends,
  getMarketingAttributionAnalytics,
};
