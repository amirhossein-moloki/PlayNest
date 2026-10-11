import { Router } from 'express';
import { validate } from '../../common/middleware/validate';
import {
  createPageSchema,
  getPageSchema,
  listPagesSchema,
  updatePageSchema,
} from './pages.validators';
import * as PagesController from './pages.controller';
import { asyncHandler } from '../../common/middleware/asyncHandler';

export const cmsPagesRouter = Router({ mergeParams: true });

cmsPagesRouter.get('/', validate(listPagesSchema), asyncHandler(PagesController.listPages));

cmsPagesRouter.get('/:pageId', validate(getPageSchema), asyncHandler(PagesController.getPage));

cmsPagesRouter.post('/', validate(createPageSchema), asyncHandler(PagesController.createPage));

cmsPagesRouter.patch('/:pageId', validate(updatePageSchema), asyncHandler(PagesController.updatePage));
