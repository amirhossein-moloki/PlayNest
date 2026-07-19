import { Router } from 'express';
import { commentsController } from './comments/comments.controller';
import { reactionsController } from './reactions/reactions.controller';
import { navigationController } from './navigation/navigation.controller';
import { postsController } from './posts/posts.controller';
import { taxonomyController } from './taxonomy/taxonomy.controller';
import { resolveGamingCenterBySlug } from '../../common/middleware/resolveGamingCenterBySlug';

export const publicBlogRouter = Router({ mergeParams: true });

// Resolve public tenant by slug
publicBlogRouter.use(resolveGamingCenterBySlug);

// Public Comments, Reactions & Navigation
publicBlogRouter.get('/comments/tree', commentsController.getCommentTree);
publicBlogRouter.get('/reactions/aggregates', reactionsController.getAggregates);
publicBlogRouter.get('/navigation/tree/:location', navigationController.getMenuTree);

// Public Blog Posts & Series
publicBlogRouter.get('/posts', postsController.getAllPosts);
publicBlogRouter.get('/posts/:id', postsController.getPostById);
publicBlogRouter.get('/series', postsController.getAllSeries);
publicBlogRouter.get('/series/:id', postsController.getSeriesById);

// Public Categories & Tags
publicBlogRouter.get('/categories', taxonomyController.getAllCategories);
publicBlogRouter.get('/categories/:id', taxonomyController.getCategoryById);
publicBlogRouter.get('/tags', taxonomyController.getAllTags);
publicBlogRouter.get('/tags/:id', taxonomyController.getTagById);
