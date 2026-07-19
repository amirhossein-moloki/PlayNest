import { Router } from 'express';
import { commentsController } from './comments.controller';
import { authMiddleware } from '../../../common/middleware/auth';
import { requireRole } from '../../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';

const router = Router({ mergeParams: true });

// Public routes
router.get('/tree', commentsController.getCommentTree);

// Protected routes
router.use(authMiddleware);

router.post('/', commentsController.createComment);
router.patch('/:id', commentsController.updateComment);
router.delete('/:id', commentsController.deleteComment);

// Moderation & Interaction routes (restricted to administrative/staff roles)
router.get('/', requireRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR]), commentsController.getComments);
router.patch('/:id/moderate', requireRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR]), commentsController.moderateComment);
router.patch('/:id/pin', requireRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR]), commentsController.pinComment);
router.post('/:id/flag', commentsController.flagComment);

export { router as commentsRouter };
