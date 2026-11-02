import { Router } from 'express';
import { postsController } from './posts.controller';
import { authMiddleware } from '../../../common/middleware/auth';
import { tenantGuard } from '../../../common/middleware/tenantGuard';
import { requireRole } from '../../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(tenantGuard);

// Posts
// Authors (MANAGER, ADMIN) can create posts.
router.post('/', requireRole([UserRole.MANAGER, UserRole.ADMIN]), postsController.createPost);
router.get('/', postsController.getAllPosts);
router.get('/:id', postsController.getPostById);

// Edit Post: MANAGER or ADMIN can update posts
router.patch('/:id', requireRole([UserRole.MANAGER, UserRole.ADMIN]), postsController.updatePost);

// Delete Post: only ADMIN, MANAGER can delete posts
router.delete('/:id', requireRole([UserRole.ADMIN, UserRole.MANAGER]), postsController.deletePost);

// Series
router.post('/series', requireRole([UserRole.ADMIN, UserRole.MANAGER]), postsController.createSeries);
router.get('/series', postsController.getAllSeries);
router.get('/series/:id', postsController.getSeriesById);
router.patch('/series/:id', requireRole([UserRole.ADMIN, UserRole.MANAGER]), postsController.updateSeries);

export { router as postsRouter };
