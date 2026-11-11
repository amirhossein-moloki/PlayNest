import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { requirePlatformAdmin } from '../../common/middleware/requirePlatformAdmin';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformCampaignsController } from './campaigns.controller';
import { PlatformSettingsController } from './settings.controller';
import { PlatformAnalyticsController } from './analytics.controller';
import { VerificationController } from '../verification/verification.controller';
import { platformAdminDashboardTemplate } from './platform-admin-ui.templates';
import { platformAnalyticsDashboardTemplate } from './platform-analytics-ui.templates';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { PlatformAdRequestsController } from './ad-requests.controller';
import { PlatformMediaController } from './media.controller';
import multer from 'multer';

const router = Router();

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed') as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  },
});

// UI Dashboard route
router.get('/dashboard', (_req, res) => {
  res.type('html').send(platformAdminDashboardTemplate());
});

// UI Standalone Platform Analytics Dashboard route
router.get('/analytics/dashboard', (_req, res) => {
  res.type('html').send(platformAnalyticsDashboardTemplate());
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
router.post('/gaming-centers', asyncHandler(PlatformAdminController.createGamingCenter));
router.get('/gaming-centers/:id', asyncHandler(PlatformAdminController.getGamingCenterById));
router.patch('/gaming-centers/:id', asyncHandler(PlatformAdminController.updateGamingCenter));
router.patch('/gaming-centers/:id/status', asyncHandler(PlatformAdminController.updateGamingCenterStatus));

// Advertisements Management across all centers
router.get('/ad-requests', asyncHandler(PlatformAdRequestsController.listAdRequests));
router.get('/ad-requests/:id', asyncHandler(PlatformAdRequestsController.getAdRequestById));
router.patch('/ad-requests/:id/status', asyncHandler(PlatformAdRequestsController.updateAdRequestStatus));
router.delete('/ad-requests/:id', asyncHandler(PlatformAdRequestsController.deleteAdRequest));

// Media Upload for Platform Super Admin
router.post('/media/upload', mediaUpload.single('file'), asyncHandler(PlatformMediaController.uploadMedia));

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

// Reservations Management across all centers
router.get('/reservations', asyncHandler(PlatformAdminController.listReservations));
router.post('/reservations/:id/cancel', asyncHandler(PlatformAdminController.cancelReservation));
router.post('/reservations/:id/confirm', asyncHandler(PlatformAdminController.confirmReservation));
router.post('/reservations/:id/start', asyncHandler(PlatformAdminController.startReservation));
router.post('/reservations/:id/complete', asyncHandler(PlatformAdminController.completeReservation));
router.post('/reservations/:id/no-show', asyncHandler(PlatformAdminController.markNoShowReservation));

// Aggregated Platform Analytics & Reports
router.get('/analytics/reports', asyncHandler(PlatformAnalyticsController.getReports));

// Operational Overview across all centers
router.get('/operations/overview', asyncHandler(PlatformAdminController.getOperationsOverview));

// Financials Overview across all centers
router.get('/financials/overview', asyncHandler(PlatformAdminController.getFinancialsOverview));
router.get('/financials/payments', asyncHandler(PlatformAdminController.listPayments));
router.get('/financials/refunds', asyncHandler(PlatformAdminController.listRefunds));
router.post('/financials/refunds/:id/retry', asyncHandler(PlatformAdminController.retryRefund));
router.post('/financials/payments/:id/reconcile', asyncHandler(PlatformAdminController.reconcilePayment));
router.get('/financials/export', asyncHandler(PlatformAdminController.exportFinancialCsv));

// System-wide Audit Logs
router.get('/audit-logs', asyncHandler(PlatformAdminController.listAuditLogs));

export default router;
