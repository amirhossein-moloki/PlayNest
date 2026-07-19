import { Router } from 'express';
import { navigationController } from './navigation.controller';
import { validate } from '../../../common/middleware/validate';
import { createMenuSchema, addMenuItemSchema, updateMenuItemSchema } from './navigation.validation';
import { authMiddleware } from '../../../common/middleware/auth';

const router = Router({ mergeParams: true });

router.get('/tree/:location', navigationController.getMenuTree);

router.use(authMiddleware);

router.post('/menus', validate(createMenuSchema), navigationController.createMenu);
router.post('/items', validate(addMenuItemSchema), navigationController.addMenuItem);
router.patch('/items/:id', validate(updateMenuItemSchema), navigationController.updateMenuItem);
router.delete('/items/:id', navigationController.deleteMenuItem);

export { router as navigationRouter };
