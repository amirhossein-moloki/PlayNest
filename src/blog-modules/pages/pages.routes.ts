import { Router } from 'express';
import { pagesController } from './pages.controller';
import { validate } from '../../common/middleware/validate';
import { createPageSchema, updatePageSchema, getPageByPathSchema } from './pages.validation';
import { auth } from '../../common/middleware/auth';

const router = Router();

router.get('/resolve', validate(getPageByPathSchema), pagesController.getPageByPath);

router.use(auth());

router.get('/', pagesController.listPages);
router.post('/', validate(createPageSchema), pagesController.createPage);
router.get('/:id', pagesController.getPageById);
router.patch('/:id', validate(updatePageSchema), pagesController.updatePage);
router.delete('/:id', pagesController.deletePage);

export default router;
