import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { requirePlatformAdmin } from '../../common/middleware/requirePlatformAdmin';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformCampaignsController } from './campaigns.controller';
import { PlatformSettingsController } from './settings.controller';
import { PlatformAnalyticsController } from './analytics.controller';
import { VerificationController } from '../verification/verification.controller';
import { platformAdminDashboardTemplate } from './platform-admin-ui.templates';
import { asyncHandler } from '../../common/middleware/asyncHandler';

const router = Router();

// UI Dashboard route
router.get('/dashboard', (_req, res) => {
  res.type('html').send(platformAdminDashboardTemplate());
});

// Secure all platform admin routes
router.use(authMiddleware, requirePlatformAdmin);

// Platform Campaigns Management
router.get('/campaigns', asyncHandler(PlatformCampaignsController.listCampaigns));
router.post('/campaigns', asyncHandler(PlatformCampaignsController.createCampaign));
router.patch('/campaigns/:id', asyncHandler(PlatformCampaignsController.updateCampaign));
router.delete('/campaigns/:id', asyncHandler(PlatformCampaignsController.deleteCampaign));

// Platform Global Settings Management
router.get('/settings', asyncHandler(PlatformSettingsController.getSettings));
router.put('/settings', asyncHandler(PlatformSettingsController.updateSettings));

// Gaming Centers Management
router.get('/gaming-centers', asyncHandler(PlatformAdminController.getAllGamingCenters));
router.get('/gaming-centers/:id', asyncHandler(PlatformAdminController.getGamingCenterById));
router.patch('/gaming-centers/:id', asyncHandler(PlatformAdminController.updateGamingCenter));
router.patch('/gaming-centers/:id/status', asyncHandler(PlatformAdminController.updateGamingCenterStatus));

// KYC Verification Management
router.get('/verifications', asyncHandler(VerificationController.listVerifications));
router.get('/verifications/:id', asyncHandler(VerificationController.getVerificationDetails));
router.post('/verifications/:id/approve', asyncHandler(VerificationController.approveVerification));
router.post('/verifications/:id/reject', asyncHandler(VerificationController.rejectVerification));

// Users Management across all centers
router.get('/users', asyncHandler(PlatformAdminController.listUsers));
router.post('/users', asyncHandler(PlatformAdminController.createUser));
router.patch('/users/:id', asyncHandler(PlatformAdminController.updateUser));
router.delete('/users/:id', asyncHandler(PlatformAdminController.deleteUser));
router.patch('/users/:id/status', asyncHandler(PlatformAdminController.updateUserStatus));
router.post('/users/:id/reset-password', asyncHandler(PlatformAdminController.resetUserPassword));
router.post('/users/:id/revoke-sessions', asyncHandler(PlatformAdminController.revokeUserSessions));

// Customers Management across all centers
router.get('/customers', asyncHandler(PlatformAdminController.listCustomers));

// Aggregated Platform Analytics & Reports
router.get('/analytics/reports', asyncHandler(PlatformAnalyticsController.getReports));
// Reservations Management across all centers
router.get('/reservations', asyncHandler(PlatformAdminController.listReservations));

// Operational Overview across all centers
router.get('/operations/overview', asyncHandler(PlatformAdminController.getOperationsOverview));

// Financials Overview across all centers
router.get('/financials/overview', asyncHandler(PlatformAdminController.getFinancialsOverview));

// System-wide Audit Logs
router.get('/audit-logs', asyncHandler(PlatformAdminController.listAuditLogs));

export default router;
