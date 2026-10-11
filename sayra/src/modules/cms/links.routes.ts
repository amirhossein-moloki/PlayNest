import { Router } from 'express';
import * as controller from './links.controller';
import { validate } from '../../common/middleware/validate';
import { createLinkSchema, updateLinkSchema } from './links.validators';
import { asyncHandler } from '../../common/middleware/asyncHandler';

export const cmsLinksRouter = Router({ mergeParams: true });

cmsLinksRouter.get('/', asyncHandler(controller.getLinks));
cmsLinksRouter.post('/', validate(createLinkSchema), asyncHandler(controller.createLink));
cmsLinksRouter.patch('/:linkId', validate(updateLinkSchema), asyncHandler(controller.updateLink));
cmsLinksRouter.delete('/:linkId', asyncHandler(controller.deleteLink));
