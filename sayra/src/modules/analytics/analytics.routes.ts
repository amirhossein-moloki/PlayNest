import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { validate } from '../../common/middleware/validate';
import { AnalyticsController } from './analytics.controller';
import { MaintenanceController } from './maintenance.controller';
import { MarketingSpendController } from './marketing-spend.controller';
import { AnalyticsQuerySchema, BenchmarkQuerySchema, CustomerAnalyticsQuerySchema, FinancialReconciliationQuerySchema } from './analytics.validators';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(tenantGuard);
router.use(requireRole([UserRole.MANAGER, UserRole.ADMIN]));

router.post('/events', AnalyticsController.collectEvent);
router.get('/visitors', validate(AnalyticsQuerySchema), AnalyticsController.getVisitors);
router.get('/summary', validate(AnalyticsQuerySchema), AnalyticsController.getSummary);
router.get('/cancellations', validate(AnalyticsQuerySchema), AnalyticsController.getCancellationAnalytics);
router.get('/reservations', validate(AnalyticsQuerySchema), AnalyticsController.getReservations);
router.get('/financials', validate(AnalyticsQuerySchema), AnalyticsController.getFinancials);
router.get('/operations/maintenance', validate(AnalyticsQuerySchema), MaintenanceController.getMaintenanceAnalytics);
router.get('/maintenance', MaintenanceController.getMaintenanceLogs);
router.get('/maintenance/:id', MaintenanceController.getMaintenanceById);
router.post('/stations/:stationId/maintenance', MaintenanceController.createMaintenance);
router.patch('/maintenance/:id', MaintenanceController.updateMaintenance);

router.get('/operations/waitlist', validate(AnalyticsQuerySchema), AnalyticsController.getWaitlist);
router.get('/operations/notifications', validate(AnalyticsQuerySchema), AnalyticsController.getNotifications);
router.get('/staff', validate(AnalyticsQuerySchema), AnalyticsController.getStaffPerformance);
router.get('/stations', validate(AnalyticsQuerySchema), AnalyticsController.getStationPerformance);
router.get('/revenue-chart', validate(AnalyticsQuerySchema), AnalyticsController.getRevenueChart);
router.get('/revenue-forecast', validate(AnalyticsQuerySchema), AnalyticsController.getRevenueForecast);
router.get('/ingestion-status', AnalyticsController.getIngestionStatus);

// Financial Analytics & Reconciliation Endpoints (Phase 4)
router.get('/financials/overview', validate(AnalyticsQuerySchema), AnalyticsController.getFinancialOverviewDetailed);
router.get('/financials/reconciliation', validate(FinancialReconciliationQuerySchema), AnalyticsController.getFinancialReconciliation);
router.post('/financials/reconciliation/run', AnalyticsController.runFinancialReconciliation);

// Customer Analytics Endpoints (Phase 3)
router.get('/customers/summary', validate(CustomerAnalyticsQuerySchema), AnalyticsController.getCustomerSummary);
router.get('/customers/activity', validate(CustomerAnalyticsQuerySchema), AnalyticsController.getCustomerActivity);
router.get('/customers/retention', validate(CustomerAnalyticsQuerySchema), AnalyticsController.getCustomerRetention);
router.get('/customers/segmentation', validate(CustomerAnalyticsQuerySchema), AnalyticsController.getCustomerSegmentation);
router.get('/customers/top-spenders', validate(CustomerAnalyticsQuerySchema), AnalyticsController.getTopSpenders);

// Phase 7 Benchmarking & Growth Insights Endpoints
router.get('/benchmarks', validate(BenchmarkQuerySchema), AnalyticsController.getBenchmarks);
router.get('/growth-insights', validate(BenchmarkQuerySchema), AnalyticsController.getGrowthInsights);

// Growth Analytics, Funnel, Discount & Instrumentation Gap Endpoints
router.get('/funnel', validate(AnalyticsQuerySchema), AnalyticsController.getConversionFunnel);
router.post('/marketing-spend', MarketingSpendController.createMarketingSpend);
router.get('/marketing-spend', MarketingSpendController.getMarketingSpends);
router.get('/marketing/cac-roas', validate(AnalyticsQuerySchema), MarketingSpendController.getMarketingAttributionAnalytics);

router.get('/discounts', validate(AnalyticsQuerySchema), AnalyticsController.getDiscountAnalytics);
router.get('/discounts/retention', validate(AnalyticsQuerySchema), AnalyticsController.getDiscountRetention);
router.get('/instrumentation-gaps', AnalyticsController.getInstrumentationGaps);

// Operations & Reliability Analytics Endpoints
router.get('/operations/jobs', AnalyticsController.getJobsHealth);
router.get('/operations/errors', validate(AnalyticsQuerySchema), AnalyticsController.getSystemErrors);
router.get('/operations/data-quality', AnalyticsController.getDataQuality);
router.get('/operations/support', validate(AnalyticsQuerySchema), AnalyticsController.getSupportQuality);
router.get('/operations/feature-adoption', validate(AnalyticsQuerySchema), AnalyticsController.getFeatureAdoption);
router.get('/operations/issue-matrix', AnalyticsController.getIssueMatrix);

export const analyticsRoutes = router;
