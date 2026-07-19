import { Router } from 'express';
import healthRouter from './health.routes';
import authRouter from '../modules/auth/auth.routes';
import gamingCenterRouter from '../modules/gamingCenter/gamingCenter.routes';

// Import the new station routers
import {
  privateStationRouter,
  publicStationRouter,
} from '../modules/station/station.routes';
import staffRouter from '../modules/users/users.routes';
import shiftsRouter from '../modules/staffShifts/staffShifts.routes';
import availabilityRouter from '../modules/availability/availability.routes';
import reservationRoutes from '../modules/reservation/reservation.routes';
import publicReservationRoutes from '../modules/reservation/reservation.public.routes';
import { cmsRouter } from '../modules/cms/cms.routes';
import { cmsAdminUiRouter } from '../modules/cms/admin-ui.routes';
import {
  publicAddressesRouter,
  publicLinksRouter,
  publicMediaRouter,
  publicPagesRouter,
  publicGamingCenterRouter,
} from '../modules/public/public.routes';
import { paymentsRoutes } from '../modules/payments/payments.routes';
import { webhooksRoutes } from '../modules/webhooks/webhooks.routes';
import { customersRouter } from '../modules/customers/customers.routes';
import {
  privateReviewsRouter,
  publicReviewsRouter,
} from '../modules/ratings/ratings.routes';
import { settingsRouter } from '../modules/settings/settings.routes';
import { commissionsRoutes } from '../modules/commissions/commissions.routes';
import auditRoutes from '../modules/audit/audit.routes';
import { analyticsRoutes } from '../modules/analytics/analytics.routes';
import { gamingSessionsRoutes } from '../modules/gamingSessions/gamingSessions.routes';
import { resolveGamingCenterBySlug } from '../common/middleware/resolveGamingCenterBySlug';
import { customerPanelRouter } from '../modules/customer-panel/customer-panel.routes';
import {
  userRouter as ticketUserRouter,
  supportRouter as ticketSupportRouter,
  adminRouter as ticketAdminRouter,
} from '../modules/tickets/tickets.routes';
import { blogRouter } from '../modules/blog/blog.routes';
import { publicBlogRouter } from '../modules/blog/public-blog.routes';

const router = Router();

// --- Existing Routes ---
router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/gamingCenters', gamingCenterRouter);

// --- GameStation Module Routes ---
// Mount the private router under the gamingCenter-specific path
router.use('/gamingCenters/:gamingCenterId/stations', privateStationRouter);

// Mount the public router under the public gamingCenter path
router.use('/public/gamingCenters/:gamingCenterSlug/stations', publicStationRouter);

// --- Staff Module Routes ---
router.use('/gamingCenters/:gamingCenterId/staff', staffRouter);

// --- Shifts Module Routes ---
// Nested under staff for clarity
router.use('/gamingCenters/:gamingCenterId/staff/:userId/staffShifts', shiftsRouter);

// --- Availability Module Routes ---
router.use(
  '/public/gamingCenters/:gamingCenterSlug/availability',
  resolveGamingCenterBySlug,
  availabilityRouter
);

// --- Reservation Module Routes ---
router.use('/gamingCenters/:gamingCenterId/reservation', reservationRoutes);
router.use('/public/gamingCenters/:gamingCenterSlug/reservation', publicReservationRoutes);

// --- Customers Module Routes ---
router.use('/gamingCenters/:gamingCenterId/customers', customersRouter);

// --- Reviews Module Routes ---
router.use('/gamingCenters/:gamingCenterId/ratings', privateReviewsRouter);

// Public GamingCenter Root & Reviews
router.use('/public/gamingCenters/:gamingCenterSlug', publicGamingCenterRouter);
router.use('/public/gamingCenters/:gamingCenterSlug', publicReviewsRouter);

// --- Settings Module Routes ---
router.use('/gamingCenters/:gamingCenterId/settings', settingsRouter);

// --- Commissions Module Routes ---
router.use('/gamingCenters/:gamingCenterId/commissions', commissionsRoutes);

// --- Audit Module Routes ---
router.use('/gamingCenters/:gamingCenterId/audit-logs', auditRoutes);

// --- Customer Panel Routes ---
router.use('/customer', customerPanelRouter);

// --- Ticket Module Routes ---
router.use('/tickets', ticketUserRouter);
router.use('/support/tickets', ticketSupportRouter);
router.use('/admin/tickets', ticketAdminRouter);

// --- Analytics Module Routes ---
router.use('/gamingCenters/:gamingCenterId/analytics', analyticsRoutes);

// --- Gaming Sessions Module Routes ---
router.use('/gamingCenters/:gamingCenterId/reservation/:reservationId/sessions', gamingSessionsRoutes);

// --- Payments Module Routes ---
router.use('/gamingCenters/:gamingCenterId/reservation', paymentsRoutes); // This will be scoped within the reservation

// --- CMS Module Routes ---
router.use('/gamingCenters/:gamingCenterId', cmsRouter);

// --- CMS Admin UI ---
router.use('/admin', cmsAdminUiRouter);

// --- Blog Module Routes ---
router.use('/gamingCenters/:gamingCenterId/blog', blogRouter);

// --- Public CMS Routes ---
router.use('/public/gamingCenters/:gamingCenterSlug/pages', publicPagesRouter);
router.use('/public/gamingCenters/:gamingCenterSlug/media', publicMediaRouter);
router.use('/public/gamingCenters/:gamingCenterSlug/links', publicLinksRouter);
router.use('/public/gamingCenters/:gamingCenterSlug/addresses', publicAddressesRouter);

// --- Public Blog Routes ---
router.use('/public/gamingCenters/:gamingCenterSlug/blog', publicBlogRouter);

// --- Webhooks Module ---
router.use(webhooksRoutes);


export default router;
