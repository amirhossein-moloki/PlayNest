import { Router } from 'express';
import * as ReviewsController from './ratings.controller';
import { validate } from '../../common/middleware/validate';
import {
  submitReviewSchema,
  moderateReviewSchema,
  replyReviewSchema,
  reviewIdParamSchema,
  listManagerReviewsSchema,
  getReviewsSchema,
} from './ratings.validators';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { resolveGamingCenterBySlug } from '../../common/middleware/resolveGamingCenterBySlug';
import { UserRole } from '@prisma/client';
import {
  privateApiRateLimiter,
  publicApiRateLimiter,
} from '../../common/middleware/rateLimit';
import { asyncHandler } from '../../common/middleware/asyncHandler';

// --- Private Router (to be mounted under /api/v1/gamingCenters/:gamingCenterId/ratings) ---
export const privateReviewsRouter = Router({ mergeParams: true });

privateReviewsRouter.use(
  privateApiRateLimiter,
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER, UserRole.ADMIN])
);

privateReviewsRouter.get(
  '/',
  validate(listManagerReviewsSchema),
  asyncHandler(ReviewsController.getManagerReviews)
);

privateReviewsRouter.patch(
  '/:id/status',
  validate(moderateReviewSchema),
  asyncHandler(ReviewsController.moderateReview)
);

privateReviewsRouter.post(
  '/:id/reply',
  validate(replyReviewSchema),
  asyncHandler(ReviewsController.replyToReview)
);

privateReviewsRouter.delete(
  '/:id/reply',
  validate(reviewIdParamSchema),
  asyncHandler(ReviewsController.deleteReviewReply)
);

// --- Public Router (to be mounted under /api/v1/public/gamingCenters/:gamingCenterSlug) ---
export const publicReviewsRouter = Router({ mergeParams: true });

publicReviewsRouter.use(publicApiRateLimiter, resolveGamingCenterBySlug);

publicReviewsRouter.post(
  '/reservation/:reservationId/ratings',
  validate(submitReviewSchema),
  asyncHandler(ReviewsController.submitReview)
);

publicReviewsRouter.get(
  '/ratings',
  validate(getReviewsSchema),
  asyncHandler(ReviewsController.getReviews)
);
