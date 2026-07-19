import { CommentStatus, SessionActorType } from '@prisma/client';
import { commentsRepository } from './comments.repository';
import { CreateCommentDto, UpdateCommentDto, CommentQueryDto, CommentResponse } from './comments.types';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { auditService } from '../audit/audit.station';
import { eventEmitter, AppEvents } from '../../common/events/event-emitter';

export const MAX_NESTING_DEPTH = 10;

export const commentsStation = {
  async createComment(gamingCenterId: string, userId: string, data: CreateCommentDto, ip?: string, userAgent?: string) {
    // 1. Anti-abuse: Rate limiting
    const recentCount = await commentsRepository.countRecentByUser(userId, 1);
    if (recentCount >= 5) {
      throw new AppError('Rate limit exceeded. Please try again later.', httpStatus.TOO_MANY_REQUESTS);
    }

    // 2. Anti-abuse: Duplicate detection with normalization
    const normalizedContent = data.content.trim().toLowerCase().replace(/\s+/g, ' ');
    const duplicate = await commentsRepository.findDuplicate(userId, data.postId, normalizedContent);
    if (duplicate) {
      throw new AppError('Duplicate comment detected.', httpStatus.BAD_REQUEST);
    }

    let depth = 0;
    let rootId: string | null = null;

    if (data.parentId) {
      const parent = await commentsRepository.findById(data.parentId, gamingCenterId);
      if (!parent) {
        throw new AppError('Parent comment not found.', httpStatus.NOT_FOUND);
      }

      // Check for deleted/rejected parent
      if (parent.status === CommentStatus.DELETED || parent.status === CommentStatus.REJECTED) {
        throw new AppError('Cannot reply to a deleted or rejected comment.', httpStatus.BAD_REQUEST);
      }

      depth = parent.depth + 1;
      rootId = parent.rootId || parent.id;

      // 3. Integrity: Enforce maximum nesting depth
      if (depth > MAX_NESTING_DEPTH) {
        throw new AppError(`Maximum comment depth of ${MAX_NESTING_DEPTH} reached.`, httpStatus.BAD_REQUEST);
      }
    }

    // AI Moderation Hook (Future)
    // await this.runAIModeration(data.content);

    const comment = await commentsRepository.create({
      ...data,
      gamingCenterId,
      userId,
      depth,
      rootId,
      status: CommentStatus.PENDING,
      ip,
      userAgent,
    });

    await auditService.log(
      gamingCenterId,
      { id: userId, actorType: SessionActorType.USER },
      'COMMENT_CREATE',
      { name: 'Comment', id: comment.id },
      { new: comment }
    );

    eventEmitter.emit(AppEvents.COMMENT_CREATED, comment);

    return comment;
  },

  async updateComment(gamingCenterId: string, userId: string, id: string, data: UpdateCommentDto) {
    const comment = await commentsRepository.findById(id, gamingCenterId);
    if (!comment) {
      throw new AppError('Comment not found.', httpStatus.NOT_FOUND);
    }

    if (comment.userId !== userId) {
      throw new AppError('You can only update your own comments.', httpStatus.FORBIDDEN);
    }

    if (comment.status === CommentStatus.DELETED) {
      throw new AppError('Cannot update a deleted comment.', httpStatus.BAD_REQUEST);
    }

    const updatedComment = await commentsRepository.update(id, {
      content: data.content,
      status: CommentStatus.PENDING, // Re-moderate on update
    });

    await auditService.log(
      gamingCenterId,
      { id: userId, actorType: SessionActorType.USER },
      'COMMENT_UPDATE',
      { name: 'Comment', id: comment.id },
      { old: comment, new: updatedComment }
    );

    eventEmitter.emit(AppEvents.COMMENT_UPDATED, updatedComment);

    return updatedComment;
  },

  async deleteComment(gamingCenterId: string, userId: string, id: string, isModerator: boolean) {
    const comment = await commentsRepository.findById(id, gamingCenterId);
    if (!comment) {
      throw new AppError('Comment not found.', httpStatus.NOT_FOUND);
    }

    if (!isModerator && comment.userId !== userId) {
      throw new AppError('You do not have permission to delete this comment.', httpStatus.FORBIDDEN);
    }

    const deletedComment = await commentsRepository.update(id, {
      status: CommentStatus.DELETED,
      isActive: false,
    });

    await auditService.log(
      gamingCenterId,
      { id: userId, actorType: SessionActorType.USER },
      'COMMENT_DELETE',
      { name: 'Comment', id: comment.id },
      { old: comment, new: deletedComment }
    );

    eventEmitter.emit(AppEvents.COMMENT_DELETED, deletedComment);

    return deletedComment;
  },

  async moderateComment(gamingCenterId: string, moderatorId: string, id: string, status: CommentStatus) {
    const comment = await commentsRepository.findById(id, gamingCenterId);
    if (!comment) {
      throw new AppError('Comment not found.', httpStatus.NOT_FOUND);
    }

    // 4. Moderation Workflow Enforcement
    if (comment.status === CommentStatus.DELETED && status !== CommentStatus.DELETED) {
      // Logic for restoration if needed, but let's assume DELETED is final for now or requires explicit RESTORE
    }

    const updatedComment = await commentsRepository.update(id, { status });

    await auditService.log(
      gamingCenterId,
      { id: moderatorId, actorType: SessionActorType.USER },
      'COMMENT_MODERATE',
      { name: 'Comment', id: comment.id },
      { old: { status: comment.status }, new: { status: updatedComment.status } }
    );

    if (status === CommentStatus.APPROVED) {
      eventEmitter.emit(AppEvents.COMMENT_APPROVED, updatedComment);
    }

    return updatedComment;
  },

  async pinComment(gamingCenterId: string, moderatorId: string, id: string, isPinned: boolean) {
    const comment = await commentsRepository.findById(id, gamingCenterId);
    if (!comment) {
      throw new AppError('Comment not found.', httpStatus.NOT_FOUND);
    }

    if (comment.status !== CommentStatus.APPROVED) {
      throw new AppError('Only approved comments can be pinned.', httpStatus.BAD_REQUEST);
    }

    const updatedComment = await commentsRepository.update(id, { isPinned });

    await auditService.log(
      gamingCenterId,
      { id: moderatorId, actorType: SessionActorType.USER },
      'COMMENT_PIN',
      { name: 'Comment', id: comment.id },
      { old: { isPinned: comment.isPinned }, new: { isPinned: updatedComment.isPinned } }
    );

    return updatedComment;
  },

  async flagComment(gamingCenterId: string, userId: string, id: string) {
    const comment = await commentsRepository.findById(id, gamingCenterId);
    if (!comment) {
      throw new AppError('Comment not found.', httpStatus.NOT_FOUND);
    }

    const updatedComment = await commentsRepository.update(id, {
      flagCount: { increment: 1 }
    });

    await auditService.log(
      gamingCenterId,
      { id: userId, actorType: SessionActorType.USER },
      'COMMENT_FLAG',
      { name: 'Comment', id: comment.id },
      { old: { flagCount: comment.flagCount }, new: { flagCount: updatedComment.flagCount } }
    );

    return updatedComment;
  },

  async getComments(gamingCenterId: string, query: CommentQueryDto) {
    return commentsRepository.findAll(gamingCenterId, query);
  },

  async getCommentTree(gamingCenterId: string, postId: string, page: number, pageSize: number) {
    const rootsResult = await commentsRepository.findRootsPaginated(gamingCenterId, postId, page, pageSize);
    const rootIds = rootsResult.data.map(r => r.id);

    const descendants = await commentsRepository.findDescendantsForRoots(rootIds);

    const treeData = rootsResult.data.map((root) => {
      const rootDescendants = descendants.filter(d => d.rootId === root.id);
      return this.buildTree(root, rootDescendants);
    });

    return {
      data: treeData,
      meta: rootsResult.meta,
    };
  },

  buildTree(root: Record<string, unknown>, descendants: Record<string, unknown>[]): CommentResponse {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const commentMap = new Map<string, any>();
    commentMap.set(root.id as string, { ...root, replies: [] });

    descendants.forEach(d => {
      commentMap.set(d.id as string, { ...d, replies: [] });
    });

    const rootNode = commentMap.get(root.id as string);

    descendants.forEach(d => {
      const parent = commentMap.get(d.parentId as string);
      if (parent) {
        if (!parent.replies) parent.replies = [];
        parent.replies.push(commentMap.get(d.id as string));
      }
    });

    return rootNode;
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
};
