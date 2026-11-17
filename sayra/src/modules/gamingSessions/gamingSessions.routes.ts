import { Router } from 'express';
import { z } from 'zod';
import { GamingSessionsController } from './gamingSessions.controller';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import { idSchema } from '../../common/validators/common.validators';
import { UserRole } from '@prisma/client';

const router = Router({ mergeParams: true });

router.use(authMiddleware, tenantGuard);

export const sessionParamsSchema = z.object({
  params: z.object({
    gamingCenterId: idSchema('Invalid gamingCenterId format'),
    reservationId: idSchema('Invalid reservationId format'),
  }),
});

export const startSessionSchema = z.object({
  params: z.object({
    gamingCenterId: idSchema('Invalid gamingCenterId format'),
    reservationId: idSchema('Invalid reservationId format'),
  }),
  body: z.object({
    stationId: idSchema('Invalid stationId format').optional(),
  }).optional(),
});

router.post(
  '/start',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(startSessionSchema),
  GamingSessionsController.startSession
);

router.post(
  '/stop',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(sessionParamsSchema),
  GamingSessionsController.endSession
);

router.post(
  '/pause',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(sessionParamsSchema),
  GamingSessionsController.pauseSession
);

router.post(
  '/resume',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(sessionParamsSchema),
  GamingSessionsController.resumeSession
);

export const gamingSessionsRoutes = router;
