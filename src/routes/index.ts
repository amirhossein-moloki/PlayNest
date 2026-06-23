import { Router } from 'express';
import healthRouter from './health.routes';
import authRouter from '../modules/auth/auth.routes';
import gamingCenterRouter from '../modules/gamingCenter/gamingCenter.routes';
import staffRouter from '../modules/users/users.routes';
import { settingsRouter } from '../modules/settings/settings.routes';
import auditRoutes from '../modules/audit/audit.routes';
import { webhooksRoutes } from '../modules/webhooks/webhooks.routes';

const router = Router();

// --- Existing Routes ---
router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/gamingCenters', gamingCenterRouter);

// --- Staff Module Routes ---
router.use('/gamingCenters/:gamingCenterId/staff', staffRouter);

// --- Settings Module Routes ---
router.use('/gamingCenters/:gamingCenterId/settings', settingsRouter);

// --- Audit Module Routes ---
router.use('/gamingCenters/:gamingCenterId/audit-logs', auditRoutes);

// --- Webhooks Module ---
router.use(webhooksRoutes);


export default router;
