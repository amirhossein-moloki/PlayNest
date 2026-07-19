import { Router } from 'express';
import { reactionsController } from './reactions.controller';
import { authMiddleware } from '../../common/middleware/auth';

const router = Router({ mergeParams: true });

// Public routes
router.get('/aggregates', reactionsController.getAggregates);

// Protected routes
router.use(authMiddleware);

router.post('/toggle', reactionsController.toggleReaction);

export { router as reactionsRouter };
