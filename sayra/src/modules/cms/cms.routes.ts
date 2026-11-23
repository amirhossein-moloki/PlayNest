import { Router } from 'express';
import { cmsMediaRouter } from './media.routes';
import { cmsLinksRouter } from './links.routes';
import { cmsAddressesRouter } from './addresses.routes';
import { cmsPagesRouter } from './pages.routes';
import { cmsSiteSettingsRouter } from './site-settings.routes';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';

export const cmsRouter = Router({ mergeParams: true });

const cmsManagerGuards = [authMiddleware, tenantGuard, requireRole([UserRole.MANAGER])];

cmsRouter.use('/pages', ...cmsManagerGuards, cmsPagesRouter);
cmsRouter.use('/media', ...cmsManagerGuards, cmsMediaRouter);
cmsRouter.use('/links', ...cmsManagerGuards, cmsLinksRouter);
cmsRouter.use('/addresses', ...cmsManagerGuards, cmsAddressesRouter);
cmsRouter.use('/site-settings', ...cmsManagerGuards, cmsSiteSettingsRouter);
