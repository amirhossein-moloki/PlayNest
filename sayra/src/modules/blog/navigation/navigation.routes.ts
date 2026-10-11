import { Router } from 'express';
import { navigationController } from './navigation.controller';
import { validate } from '../../../common/middleware/validate';
import { createMenuSchema, addMenuItemSchema, updateMenuItemSchema } from './navigation.validation';
import { authMiddleware } from '../../../common/middleware/auth';
import { tenantGuard } from '../../../common/middleware/tenantGuard';
import { requireRole } from '../../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';

const router = Router({ mergeParams: true });

// Public menu retrieval
router.get('/tree/:location', navigationController.getMenuTree);

// Protected administrative management routes
router.use(authMiddleware);
router.use(tenantGuard);
router.use(requireRole([UserRole.ADMIN, UserRole.MANAGER]));

router.post('/menus', validate(createMenuSchema), navigationController.createMenu);
router.post('/items', validate(addMenuItemSchema), navigationController.addMenuItem);
router.patch('/items/:id', validate(updateMenuItemSchema), navigationController.updateMenuItem);
router.delete('/items/:id', navigationController.deleteMenuItem);

export { router as navigationRouter };
