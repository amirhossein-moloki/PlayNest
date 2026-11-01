import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { requirePlatformAdmin } from '../../common/middleware/requirePlatformAdmin';
import { PlatformAdminController } from './platform-admin.controller';
import { platformAdminDashboardTemplate } from './platform-admin-ui.templates';
import { asyncHandler } from '../../common/middleware/asyncHandler';

const router = Router();

// UI Dashboard route
router.get('/dashboard', (_req, res) => {
  res.type('html').send(platformAdminDashboardTemplate());
});

// Secure all platform admin routes
router.use(authMiddleware, requirePlatformAdmin);

// Gaming Centers Management
router.get('/gaming-centers', asyncHandler(PlatformAdminController.getAllGamingCenters));
router.patch('/gaming-centers/:id/status', asyncHandler(PlatformAdminController.updateGamingCenterStatus));

// Users Management across all centers
router.get('/users', asyncHandler(PlatformAdminController.listUsers));
router.patch('/users/:id/status', asyncHandler(PlatformAdminController.updateUserStatus));
router.post('/users/:id/reset-password', asyncHandler(PlatformAdminController.resetUserPassword));
router.post('/users/:id/revoke-sessions', asyncHandler(PlatformAdminController.revokeUserSessions));

// Customers Management across all centers
router.get('/customers', asyncHandler(PlatformAdminController.listCustomers));

// Operational Overview across all centers
router.get('/operations/overview', asyncHandler(PlatformAdminController.getOperationsOverview));

// Financials Overview across all centers
router.get('/financials/overview', asyncHandler(PlatformAdminController.getFinancialsOverview));

// System-wide Audit Logs
router.get('/audit-logs', asyncHandler(PlatformAdminController.listAuditLogs));

export default router;
