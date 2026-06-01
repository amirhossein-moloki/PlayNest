
import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { validate } from '../../common/middleware/validate';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsQuerySchema } from './analytics.validators';
import { asyncHandler } from '../../common/middleware/asyncHandler';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(tenantGuard);
router.use(requireRole([UserRole.MANAGER]));

router.get('/summary', validate(AnalyticsQuerySchema), AnalyticsController.getSummary);
router.get('/staff', validate(AnalyticsQuerySchema), AnalyticsController.getStaffPerformance);
router.get('/stations', validate(AnalyticsQuerySchema), AnalyticsController.getServicePerformance);
router.get('/revenue-chart', validate(AnalyticsQuerySchema), AnalyticsController.getRevenueChart);

export const analyticsRoutes = router;
