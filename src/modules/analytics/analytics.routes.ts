
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
router.use(requireRole([UserRole.MANAGER]));

router.get('/summary', validate(AnalyticsQuerySchema as any), AnalyticsController.getSummary); // eslint-disable-line @typescript-eslint/no-explicit-any
router.get('/staff', validate(AnalyticsQuerySchema as any), AnalyticsController.getStaffPerformance); // eslint-disable-line @typescript-eslint/no-explicit-any
router.get('/stations', validate(AnalyticsQuerySchema as any), AnalyticsController.getServicePerformance); // eslint-disable-line @typescript-eslint/no-explicit-any
router.get('/revenue-chart', validate(AnalyticsQuerySchema as any), AnalyticsController.getRevenueChart); // eslint-disable-line @typescript-eslint/no-explicit-any

export const analyticsRoutes = router;
