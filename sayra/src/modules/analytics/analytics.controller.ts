import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AnalyticsStation } from './analytics.station';
import { EventsCollector } from './events.collector';
import { ForecastingService } from './forecasting.service';
import { AnalyticsQuery, BenchmarkQuery, CustomerAnalyticsQuery, FinancialReconciliationQuery } from './analytics.validators';

const collectEvent = asyncHandler(async (req: AppRequest, res: Response) => {
  const result = await EventsCollector.collectEvent(req.body);
  res.ok(result);
});

const getVisitors = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getVisitorReport(req.tenant.gamingCenterId, startDate, endDate);
  res.ok(result);
});

const getCancellationAnalytics = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getCancellationAnalytics(req.tenant.gamingCenterId, startDate, endDate);
  res.ok(result);
});

const getDiscountRetention = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getDiscountRetentionAnalytics(req.tenant.gamingCenterId, startDate, endDate);
  res.ok(result);
});

const getSummary = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getSummary(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getRevenueForecast = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate, horizon } = req.query as unknown as AnalyticsQuery & { horizon?: number };
  const result = await ForecastingService.generateRevenueForecast({
    gamingCenterId: req.tenant.gamingCenterId,
    horizonDays: horizon ? Number(horizon) : 7,
    startDate,
    endDate,
  });

  res.ok(result);
});

// Phase 7 Benchmarking & Growth Insights Controllers
const getBenchmarks = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate, peerGroupCategory } = req.query as unknown as BenchmarkQuery;
  const result = await AnalyticsStation.getBenchmarks(req.tenant.gamingCenterId, startDate, endDate, peerGroupCategory);

  res.ok(result);
});

const getGrowthInsights = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate, peerGroupCategory } = req.query as unknown as BenchmarkQuery;
  const result = await AnalyticsStation.getGrowthInsights(req.tenant.gamingCenterId, startDate, endDate, peerGroupCategory);

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

const getFinancialOverviewDetailed = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate, currency } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getFinancialOverviewDetailed(req.tenant.gamingCenterId, startDate, endDate, currency);

  res.ok(result);
});

const getFinancialReconciliation = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate, status, ruleId, limit } = req.query as unknown as FinancialReconciliationQuery;
  const result = await AnalyticsStation.getFinancialReconciliation(
    req.tenant.gamingCenterId,
    startDate,
    endDate,
    status,
    ruleId,
    limit
  );

  res.ok(result);
});

const runFinancialReconciliation = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.body as { startDate?: Date; endDate?: Date };
  const sDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const eDate = endDate ? new Date(endDate) : new Date();

  const result = await AnalyticsStation.getFinancialReconciliation(
    req.tenant.gamingCenterId,
    sDate,
    eDate,
    'ALL',
    undefined,
    100
  );

  res.ok(result);
});

const getConversionFunnel = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getConversionFunnel(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getDiscountAnalytics = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getDiscountAnalytics(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getInstrumentationGaps = asyncHandler(async (_req: AppRequest, res: Response) => {
  const result = await AnalyticsStation.getInstrumentationGaps();

  res.ok(result);
});

// Operations & Reliability Analytics Controllers
const getJobsHealth = asyncHandler(async (_req: AppRequest, res: Response) => {
  const result = await AnalyticsStation.getJobsHealth();

  res.ok(result);
});

const getSystemErrors = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getSystemErrors(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getDataQuality = asyncHandler(async (req: AppRequest, res: Response) => {
  const result = await AnalyticsStation.getDataQuality(req.tenant.gamingCenterId);

  res.ok(result);
});

const getSupportQuality = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getSupportQuality(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getFeatureAdoption = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getFeatureAdoption(req.tenant.gamingCenterId, startDate, endDate);

  res.ok(result);
});

const getIssueMatrix = asyncHandler(async (_req: AppRequest, res: Response) => {
  const result = await AnalyticsStation.getIssueMatrix();

  res.ok(result);
});

export const AnalyticsController = {
  collectEvent,
  getVisitors,
  getCancellationAnalytics,
  getSummary,
  getReservations,
  getFinancials,
  getWaitlist,
  getNotifications,
  getStaffPerformance,
  getStationPerformance,
  getRevenueChart,
  getRevenueForecast,
  getIngestionStatus,
  getCustomerSummary,
  getCustomerActivity,
  getCustomerRetention,
  getCustomerSegmentation,
  getTopSpenders,
  getFinancialOverviewDetailed,
  getFinancialReconciliation,
  runFinancialReconciliation,
  getBenchmarks,
  getGrowthInsights,
  getConversionFunnel,
  getDiscountAnalytics,
  getDiscountRetention,
  getInstrumentationGaps,
  getJobsHealth,
  getSystemErrors,
  getDataQuality,
  getSupportQuality,
  getFeatureAdoption,
  getIssueMatrix,
};
