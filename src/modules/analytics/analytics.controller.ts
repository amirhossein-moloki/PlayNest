
import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AnalyticsService } from './analytics.station';
import { subDays } from 'date-fns';

const getDates = (query: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const startDate = query.startDate ? new Date(query.startDate as string) : subDays(new Date(), 30);
  const endDate = query.endDate ? new Date(query.endDate as string) : new Date();
  return { startDate, endDate };
};

const getSummary = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = getDates(req.query);
  const result = await AnalyticsService.getSummary(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getStaffPerformance = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = getDates(req.query);
  const result = await AnalyticsService.getStaffPerformance(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getServicePerformance = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = getDates(req.query);
  const result = await AnalyticsService.getServicePerformance(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getRevenueChart = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = getDates(req.query);
  const result = await AnalyticsService.getRevenueChart(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

export const AnalyticsController = {
  getSummary,
  getStaffPerformance,
  getServicePerformance,
  getRevenueChart,
};
