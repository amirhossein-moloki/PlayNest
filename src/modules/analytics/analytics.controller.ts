
import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AnalyticsService } from './analytics.station';
import { AnalyticsQuery } from './analytics.validators';

const getSummary = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsService.getSummary(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getStaffPerformance = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsService.getStaffPerformance(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getServicePerformance = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsService.getServicePerformance(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getRevenueChart = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsService.getRevenueChart(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

export const AnalyticsController = {
  getSummary,
  getStaffPerformance,
  getServicePerformance,
  getRevenueChart,
};
