import { Router } from 'express';
import { postsController } from './posts.controller';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(tenantGuard);

// Posts
router.post('/', requireRole([UserRole.ADMIN, UserRole.MANAGER]), postsController.createPost);
router.get('/', postsController.getAllPosts);
router.get('/:id', postsController.getPostById);
router.patch('/:id', requireRole([UserRole.ADMIN, UserRole.MANAGER]), postsController.updatePost);
router.delete('/:id', requireRole([UserRole.ADMIN, UserRole.MANAGER]), postsController.deletePost);

// Series
router.post('/series', requireRole([UserRole.ADMIN, UserRole.MANAGER]), postsController.createSeries);
router.get('/series', postsController.getAllSeries);
router.get('/series/:id', postsController.getSeriesById);
router.patch('/series/:id', requireRole([UserRole.ADMIN, UserRole.MANAGER]), postsController.updateSeries);

export { router as postsRouter };
