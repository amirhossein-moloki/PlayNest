import { Router } from 'express';
import { commentsController } from './comments/comments.controller';
import { reactionsController } from './reactions/reactions.controller';
import { navigationController } from './navigation/navigation.controller';
import { resolveGamingCenterBySlug } from '../../common/middleware/resolveGamingCenterBySlug';

export const publicBlogRouter = Router({ mergeParams: true });

// Resolve public tenant by slug
publicBlogRouter.use(resolveGamingCenterBySlug);

publicBlogRouter.get('/comments/tree', commentsController.getCommentTree);
publicBlogRouter.get('/reactions/aggregates', reactionsController.getAggregates);
publicBlogRouter.get('/navigation/tree/:location', navigationController.getMenuTree);
