import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { postsRepository } from './posts.repository';
import { CreatePostInput, UpdatePostInput, CreateSeriesInput, UpdateSeriesInput } from './posts.types';
import { ListPostsQuery } from './posts.validation';
import { SessionActorType, PageStatus } from '@prisma/client';
import { auditService } from '../audit/audit.station';
import { prisma } from '../../config/prisma';
import { cmsSyncMediaQueue } from '../../jobs/queues';
import xss from 'xss';
import { eventEmitter } from '../../common/events/event-emitter';

export const postsStation = {
  // --- Post Logic ---
  async createPost(
    data: CreatePostInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await postsRepository.findPostBySlug(data.slug, data.gamingCenterId);
    if (existing) {
      throw new AppError('Post with this slug already exists for this tenant', httpStatus.CONFLICT);
    }

    // Ensure author exists (Check if user has an AuthorProfile)
    const authorProfile = await prisma.authorProfile.findUnique({
      where: { userId: data.authorId },
    });

    if (!authorProfile) {
      // Create an author profile if it doesn't exist for the user
      const user = await prisma.user.findUnique({ where: { id: data.authorId } });
      if (!user) {
        throw new AppError('User not found', httpStatus.NOT_FOUND);
      }
      await prisma.authorProfile.create({
        data: {
          userId: user.id,
          displayName: user.fullName,
        }
      });
    }

    // Handle scheduling
    if (data.status === PageStatus.SCHEDULED && !data.scheduledAt) {
      throw new AppError('Scheduled posts must have a scheduledAt date', httpStatus.BAD_REQUEST);
    }

    if (data.status === PageStatus.PUBLISHED && !data.publishedAt) {
      data.publishedAt = new Date();
    }

    // HTML Sanitization
    data.content = xss(data.content);
    data.excerpt = xss(data.excerpt);

    const post = await postsRepository.createPost(data);

    await auditService.log(
      data.gamingCenterId,
      actor,
      'CMS_POST_CREATE',
      { name: 'Post', id: post.id },
      { old: null, new: post },
      context
    );

    // Trigger Media Sync
    await cmsSyncMediaQueue.add(`sync-media-${post.id}`, { postId: post.id });

    // Emit Event
    eventEmitter.emit('CMS_POST_CREATED', { postId: post.id, gamingCenterId: post.gamingCenterId });
    if (post.status === PageStatus.PUBLISHED) {
      eventEmitter.emit('CMS_POST_PUBLISHED', { postId: post.id, gamingCenterId: post.gamingCenterId });
    }

    return post;
  },

  async getPostById(id: string, gamingCenterId: string) {
    const post = await postsRepository.findPostById(id, gamingCenterId);
    if (!post) {
      throw new AppError('Post not found', httpStatus.NOT_FOUND);
    }
    return post;
  },

  async getAllPosts(gamingCenterId: string, query: ListPostsQuery) {
    return postsRepository.findAllPosts(gamingCenterId, query);
  },

  async updatePost(
    id: string,
    gamingCenterId: string,
    data: UpdatePostInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const post = await postsRepository.findPostById(id, gamingCenterId);
    if (!post) {
      throw new AppError('Post not found', httpStatus.NOT_FOUND);
    }

    if (data.slug && data.slug !== post.slug) {
      const existing = await postsRepository.findPostBySlug(data.slug, gamingCenterId);
      if (existing) {
        throw new AppError('Post with this slug already exists for this tenant', httpStatus.CONFLICT);
      }
    }

    // Strict State Transition Validation
    if (data.status && data.status !== post.status) {
      this.validateStateTransition(post.status, data.status);
    }

    if (data.status === PageStatus.SCHEDULED && !data.scheduledAt && !post.scheduledAt) {
      throw new AppError('Scheduled posts must have a scheduledAt date', httpStatus.BAD_REQUEST);
    }

    if (data.status === PageStatus.PUBLISHED && !post.publishedAt && !data.publishedAt) {
      data.publishedAt = new Date();
    }

    // HTML Sanitization
    if (data.content) data.content = xss(data.content);
    if (data.excerpt) data.excerpt = xss(data.excerpt);

    // Create Revision if content changes
    if (data.content || data.title || data.excerpt) {
      await postsRepository.createRevision({
        postId: id,
        editorId: actor.id,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        changeNote: data.changeNote,
      });
    }

    const updated = await postsRepository.updatePost(id, data);

    await auditService.log(
      gamingCenterId,
      actor,
      'CMS_POST_UPDATE',
      { name: 'Post', id },
      { old: post, new: updated },
      context
    );

    // Trigger Media Sync if content changed
    if (data.content) {
      await cmsSyncMediaQueue.add(`sync-media-${id}`, { postId: id });
    }

    // Emit Events
    eventEmitter.emit('CMS_POST_UPDATED', { postId: id, gamingCenterId });
    if (post.status !== PageStatus.PUBLISHED && updated.status === PageStatus.PUBLISHED) {
      eventEmitter.emit('CMS_POST_PUBLISHED', { postId: id, gamingCenterId });
    }

    return updated;
  },

  validateStateTransition(current: PageStatus, next: PageStatus) {
    const allowedTransitions: Record<PageStatus, PageStatus[]> = {
      [PageStatus.DRAFT]: [PageStatus.REVIEW, PageStatus.SCHEDULED, PageStatus.PUBLISHED, PageStatus.ARCHIVED],
      [PageStatus.REVIEW]: [PageStatus.DRAFT, PageStatus.SCHEDULED, PageStatus.PUBLISHED, PageStatus.ARCHIVED],
      [PageStatus.SCHEDULED]: [PageStatus.DRAFT, PageStatus.PUBLISHED, PageStatus.ARCHIVED],
      [PageStatus.PUBLISHED]: [PageStatus.ARCHIVED, PageStatus.DRAFT],
      [PageStatus.ARCHIVED]: [PageStatus.DRAFT],
    };

    if (!allowedTransitions[current].includes(next)) {
      throw new AppError(`Transition from ${current} to ${next} is not allowed`, httpStatus.BAD_REQUEST);
    }
  },

  async deletePost(
    id: string,
    gamingCenterId: string,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const post = await postsRepository.findPostById(id, gamingCenterId);
    if (!post) {
      throw new AppError('Post not found', httpStatus.NOT_FOUND);
    }
    const result = await postsRepository.softDeletePost(id);

    await auditService.log(
      gamingCenterId,
      actor,
      'CMS_POST_DELETE',
      { name: 'Post', id },
      { old: post, new: result },
      context
    );

    return result;
  },

  // --- Series Logic ---
  async createSeries(
    data: CreateSeriesInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await postsRepository.findSeriesBySlug(data.slug, data.gamingCenterId);
    if (existing) {
      throw new AppError('Series with this slug already exists for this tenant', httpStatus.CONFLICT);
    }
    const series = await postsRepository.createSeries(data);

    await auditService.log(
      data.gamingCenterId,
      actor,
      'CMS_SERIES_CREATE',
      { name: 'Series', id: series.id },
      { old: null, new: series },
      context
    );

    return series;
  },

  async getAllSeries(gamingCenterId: string) {
    return postsRepository.findAllSeries(gamingCenterId);
  },

  async getSeriesById(id: string, gamingCenterId: string) {
    const series = await postsRepository.findSeriesById(id, gamingCenterId);
    if (!series) {
      throw new AppError('Series not found', httpStatus.NOT_FOUND);
    }
    return series;
  },

  async updateSeries(
    id: string,
    gamingCenterId: string,
    data: UpdateSeriesInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const series = await postsRepository.findSeriesById(id, gamingCenterId);
    if (!series) {
      throw new AppError('Series not found', httpStatus.NOT_FOUND);
    }
    const updated = await postsRepository.updateSeries(id, data);

    await auditService.log(
      gamingCenterId,
      actor,
      'CMS_SERIES_UPDATE',
      { name: 'Series', id },
      { old: series, new: updated },
      context
    );

    return updated;
  },
};
