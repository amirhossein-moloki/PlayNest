import { Router } from 'express';
import { validate } from '../../common/middleware/validate';
import { updateSiteSettingsSchema } from './site-settings.validators';
import * as SiteSettingsController from './site-settings.controller';
import { asyncHandler } from '../../common/middleware/asyncHandler';

export const cmsSiteSettingsRouter = Router({ mergeParams: true });

cmsSiteSettingsRouter.get('/', asyncHandler(SiteSettingsController.getSiteSettings));

cmsSiteSettingsRouter.put(
  '/',
  validate(updateSiteSettingsSchema),
  asyncHandler(SiteSettingsController.upsertSiteSettings)
);
