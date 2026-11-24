import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { publicApiRateLimiter } from '../../common/middleware/rateLimit';
import { SearchController } from './search.controller';

export const publicSearchRouter = Router();

publicSearchRouter.get(
  '/gamecenters',
  publicApiRateLimiter,
  asyncHandler(SearchController.searchGameCenters)
);

publicSearchRouter.get(
  '/suggest',
  publicApiRateLimiter,
  asyncHandler(SearchController.suggest)
);

publicSearchRouter.get(
  '/games',
  publicApiRateLimiter,
  asyncHandler(SearchController.searchGames)
);
