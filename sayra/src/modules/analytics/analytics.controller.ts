import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AnalyticsStation } from './analytics.station';
import { AnalyticsQuery } from './analytics.validators';

const getSummary = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getSummary(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getReservations = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getReservationReport(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getFinancials = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate, currency } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getFinancialReport(req.tenant.gamingCenterId, startDate, endDate, currency);

  res.ok(result);
});

const getWaitlist = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getWaitlistReport(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getNotifications = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getNotificationReport(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getStaffPerformance = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getStaffPerformance(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getStationPerformance = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getStationPerformance(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getRevenueChart = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getRevenueChart(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

export const AnalyticsController = {
  getSummary,
  getReservations,
  getFinancials,
  getWaitlist,
  getNotifications,
  getStaffPerformance,
  getStationPerformance,
  getRevenueChart,
};
