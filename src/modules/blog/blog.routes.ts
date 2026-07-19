import { Router } from 'express';
import { postsRouter } from './posts/posts.routes';
import { commentsRouter } from './comments/comments.routes';
import { reactionsRouter } from './reactions/reactions.routes';
import { taxonomyRouter } from './taxonomy/taxonomy.routes';
import { navigationRouter } from './navigation/navigation.routes';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';

export const blogRouter = Router({ mergeParams: true });

// Private / Tenant-scoped routes for management
blogRouter.use(authMiddleware, tenantGuard, (req, _res, next) => {
  req.gamingCenterId = req.params.gamingCenterId;
  next();
});

blogRouter.use('/posts', postsRouter);
blogRouter.use('/comments', commentsRouter);
blogRouter.use('/reactions', reactionsRouter);
blogRouter.use('/taxonomy', taxonomyRouter);
blogRouter.use('/navigation', navigationRouter);
