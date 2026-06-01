import { Router } from 'express';
import * as ReviewsController from './ratings.controller';
import { validate } from '../../common/middleware/validate';
import {
  submitReviewSchema,
  moderateReviewSchema,
  getReviewsSchema,
} from './ratings.validators';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { resolveSalonBySlug } from '../../common/middleware/resolveSalonBySlug';
import { UserRole } from '@prisma/client';
import {
  privateApiRateLimiter,
  publicApiRateLimiter,
} from '../../common/middleware/rateLimit';
import { asyncHandler } from '../../common/middleware/asyncHandler';

// --- Private Router (to be mounted under /api/v1/gamingCenters/:gamingCenterId/ratings) ---
export const privateReviewsRouter = Router({ mergeParams: true });

privateReviewsRouter.use(privateApiRateLimiter, authMiddleware, tenantGuard);

privateReviewsRouter.patch(
  '/:id/status',
  requireRole([UserRole.MANAGER]),
  validate(moderateReviewSchema),
  asyncHandler(ReviewsController.moderateReview)
);

// --- Public Router (to be mounted under /api/v1/public/gamingCenters/:salonSlug) ---
export const publicReviewsRouter = Router({ mergeParams: true });

publicReviewsRouter.use(publicApiRateLimiter, resolveSalonBySlug);

publicReviewsRouter.post(
  '/reservations/:reservationId/ratings',
  validate(submitReviewSchema),
  asyncHandler(ReviewsController.submitReview)
);

publicReviewsRouter.get(
  '/ratings',
  validate(getReviewsSchema),
  asyncHandler(ReviewsController.getReviews)
);
