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
// Authors (STAFF, SUPERVISOR, MANAGER, ADMIN) can create posts.
router.post('/', requireRole([UserRole.STAFF, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN]), postsController.createPost);
router.get('/', postsController.getAllPosts);
router.get('/:id', postsController.getPostById);

// Edit Post: any author can hit this, but posts.station.ts checks if own post or if they are editor
router.patch('/:id', requireRole([UserRole.STAFF, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN]), postsController.updatePost);

// Delete Post: only ADMIN, MANAGER can delete posts
router.delete('/:id', requireRole([UserRole.ADMIN, UserRole.MANAGER]), postsController.deletePost);

// Series
router.post('/series', requireRole([UserRole.ADMIN, UserRole.MANAGER]), postsController.createSeries);
router.get('/series', postsController.getAllSeries);
router.get('/series/:id', postsController.getSeriesById);
router.patch('/series/:id', requireRole([UserRole.ADMIN, UserRole.MANAGER]), postsController.updateSeries);

export { router as postsRouter };
