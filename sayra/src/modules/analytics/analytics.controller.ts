import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AnalyticsStation } from './analytics.station';
import { AnalyticsQuery, CustomerAnalyticsQuery } from './analytics.validators';

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

const getIngestionStatus = asyncHandler(async (_req: AppRequest, res: Response) => {
  const result = await AnalyticsStation.getIngestionStatus();

  res.ok(result);
});

// Customer Analytics Controllers (Phase 3)
const getCustomerSummary = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as CustomerAnalyticsQuery;
  const result = await AnalyticsStation.getCustomerSummary(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getCustomerActivity = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as CustomerAnalyticsQuery;
  const result = await AnalyticsStation.getCustomerActivity(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getCustomerRetention = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as CustomerAnalyticsQuery;
  const result = await AnalyticsStation.getCustomerRetention(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getCustomerSegmentation = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as CustomerAnalyticsQuery;
  const result = await AnalyticsStation.getCustomerSegmentation(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getTopSpenders = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate, limit } = req.query as unknown as CustomerAnalyticsQuery;
  const result = await AnalyticsStation.getTopSpenders(req.tenant.gamingCenterId, startDate, endDate, limit);

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
  getIngestionStatus,
  getCustomerSummary,
  getCustomerActivity,
  getCustomerRetention,
  getCustomerSegmentation,
  getTopSpenders,
};
