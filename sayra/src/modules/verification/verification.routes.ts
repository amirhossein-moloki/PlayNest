import { Router } from 'express';
import { VerificationController } from './verification.controller';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/middleware/asyncHandler';

export const gamingCenterVerificationRouter = Router({ mergeParams: true });

gamingCenterVerificationRouter.use(authMiddleware, tenantGuard, requireRole([UserRole.MANAGER, UserRole.ADMIN]));

gamingCenterVerificationRouter.post('/', asyncHandler(VerificationController.submitVerification));
gamingCenterVerificationRouter.get('/', asyncHandler(VerificationController.getVerificationStatus));
