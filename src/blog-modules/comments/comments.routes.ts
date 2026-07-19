import { Router } from 'express';
import { commentsController } from './comments.controller';
import { authMiddleware } from '../../common/middleware/auth';

const router = Router({ mergeParams: true });

// Public routes
router.get('/tree', commentsController.getCommentTree);

// Protected routes
router.use(authMiddleware);

router.post('/', commentsController.createComment);
router.patch('/:id', commentsController.updateComment);
router.delete('/:id', commentsController.deleteComment);

// Moderation & Interaction routes
router.get('/', commentsController.getComments);
router.patch('/:id/moderate', commentsController.moderateComment);
router.patch('/:id/pin', commentsController.pinComment);
router.post('/:id/flag', commentsController.flagComment);

export { router as commentsRouter };
