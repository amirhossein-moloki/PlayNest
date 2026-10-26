import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { validate } from '../../common/middleware/validate';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsQuerySchema } from './analytics.validators';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(tenantGuard);
router.use(requireRole([UserRole.MANAGER, UserRole.ADMIN]));

router.get('/summary', validate(AnalyticsQuerySchema), AnalyticsController.getSummary);
router.get('/reservations', validate(AnalyticsQuerySchema), AnalyticsController.getReservations);
router.get('/financials', validate(AnalyticsQuerySchema), AnalyticsController.getFinancials);
router.get('/operations/waitlist', validate(AnalyticsQuerySchema), AnalyticsController.getWaitlist);
router.get('/operations/notifications', validate(AnalyticsQuerySchema), AnalyticsController.getNotifications);
router.get('/staff', validate(AnalyticsQuerySchema), AnalyticsController.getStaffPerformance);
router.get('/stations', validate(AnalyticsQuerySchema), AnalyticsController.getStationPerformance);
router.get('/revenue-chart', validate(AnalyticsQuerySchema), AnalyticsController.getRevenueChart);
router.get('/ingestion-status', AnalyticsController.getIngestionStatus);

export const analyticsRoutes = router;
