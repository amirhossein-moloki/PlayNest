import { Router } from 'express';
import { taxonomyController } from './taxonomy.controller';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(tenantGuard);

// Categories
router.post('/categories', requireRole([UserRole.ADMIN, UserRole.MANAGER]), taxonomyController.createCategory);
router.get('/categories', taxonomyController.getAllCategories);
router.get('/categories/:id', taxonomyController.getCategoryById);
router.patch('/categories/:id', requireRole([UserRole.ADMIN, UserRole.MANAGER]), taxonomyController.updateCategory);
router.delete('/categories/:id', requireRole([UserRole.ADMIN, UserRole.MANAGER]), taxonomyController.deleteCategory);

// Tags
router.post('/tags', requireRole([UserRole.ADMIN, UserRole.MANAGER]), taxonomyController.createTag);
router.get('/tags', taxonomyController.getAllTags);
router.get('/tags/:id', taxonomyController.getTagById);
router.patch('/tags/:id', requireRole([UserRole.ADMIN, UserRole.MANAGER]), taxonomyController.updateTag);
router.delete('/tags/:id', requireRole([UserRole.ADMIN, UserRole.MANAGER]), taxonomyController.deleteTag);

export { router as taxonomyRouter };
