import { Router } from 'express';
import { GamingSessionsController } from './gamingSessions.controller';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';

const router = Router({ mergeParams: true });

router.use(authMiddleware, tenantGuard);

router.post(
  '/start',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  GamingSessionsController.startSession
);

router.post(
  '/stop',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  GamingSessionsController.endSession
);

router.post(
  '/pause',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  GamingSessionsController.pauseSession
);

router.post(
  '/resume',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  GamingSessionsController.resumeSession
);

export const gamingSessionsRoutes = router;
