import { Router } from 'express';
import { publicApiRateLimiter } from '../../common/middleware/rateLimit';
import { resolveGamingCenterBySlug } from '../../common/middleware/resolveGamingCenterBySlug';
import { getPublicAddresses } from './addresses.public.controller';
import { getPublicLinks } from './links.public.controller';
import { getPublicMedia } from './media.public.controller';
import {
  getPublicPage,
  getPublicGamingCenterHome,
} from './pages.public.controller';

export const publicGamingCenterRouter = Router({ mergeParams: true });
export const publicPagesRouter = Router({ mergeParams: true });
export const publicMediaRouter = Router({ mergeParams: true });
export const publicLinksRouter = Router({ mergeParams: true });
export const publicAddressesRouter = Router({ mergeParams: true });

publicPagesRouter.get(
  '/:pageSlug',
  publicApiRateLimiter,
  resolveGamingCenterBySlug,
  getPublicPage
);

publicMediaRouter.get(
  '/',
  publicApiRateLimiter,
  resolveGamingCenterBySlug,
  getPublicMedia
);

publicLinksRouter.get(
  '/',
  publicApiRateLimiter,
  resolveGamingCenterBySlug,
  getPublicLinks
);

publicAddressesRouter.get(
  '/',
  publicApiRateLimiter,
  resolveGamingCenterBySlug,
  getPublicAddresses
);

publicGamingCenterRouter.get(
  '/',
  publicApiRateLimiter,
  resolveGamingCenterBySlug,
  getPublicGamingCenterHome
);
