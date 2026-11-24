import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { publicApiRateLimiter } from '../../common/middleware/rateLimit';
import { PublicGameCentersApiController } from './public-gamecenters.controller';

export const publicGameCentersV2Router = Router();

// IMPORTANT: /rankings MUST be registered before /:id so "rankings" is not treated as an ID.
publicGameCentersV2Router.get(
  '/rankings',
  publicApiRateLimiter,
  asyncHandler(PublicGameCentersApiController.getRankings)
);

publicGameCentersV2Router.get(
  '/',
  publicApiRateLimiter,
  asyncHandler(PublicGameCentersApiController.listGameCenters)
);

publicGameCentersV2Router.get(
  '/:id',
  publicApiRateLimiter,
  asyncHandler(PublicGameCentersApiController.getGameCenterById)
);
