import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { dashboardTemplate } from './dashboard-ui.templates';

export const dashboardAdminUiRouter = Router({ mergeParams: true });

const renderDashboard = (req: Request, res: Response) => {
  const { gamingCenterId } = req.params;
  const html = dashboardTemplate(gamingCenterId);
  res.type('html').send(html);
};

// Supported Route Pattern 1: /admin/gamingCenters/:gamingCenterId/dashboard
dashboardAdminUiRouter.get(
  '/gamingCenters/:gamingCenterId/dashboard',
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  renderDashboard
);

// Supported Route Pattern 2: /gamingCenters/:gamingCenterId/dashboard
dashboardAdminUiRouter.get(
  '/dashboard',
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  renderDashboard
);
