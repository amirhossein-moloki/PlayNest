import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { dashboardTemplate } from './dashboard-ui.templates';

export const dashboardAdminUiRouter = Router({ mergeParams: true });

dashboardAdminUiRouter.get('/gamingCenters/:gamingCenterId/dashboard', authMiddleware, tenantGuard, requireRole([UserRole.MANAGER, UserRole.ADMIN]), (req, res) => {
  const { gamingCenterId } = req.params;
  const html = dashboardTemplate(gamingCenterId);
  res.type('html').send(html);
});
