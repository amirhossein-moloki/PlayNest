import { Request, Response, NextFunction } from 'express';
import { commentsStation } from './comments.station';
import { createCommentSchema, updateCommentSchema, moderateCommentSchema, commentQuerySchema } from './comments.validation';
import { commentsPolicy } from './comments.policy';
import AppError from '../../../common/errors/AppError';
import httpStatus from 'http-status';
import { CreateCommentDto, UpdateCommentDto } from './comments.types';

export const commentsController = {
  async createComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId } = req.params;
      const validatedData = createCommentSchema.parse(req.body);
      const comment = await commentsStation.createComment(
        gamingCenterId,
        req.actor!.id,
        validatedData as CreateCommentDto,
        req.ip,
        req.get('User-Agent')
      );
      res.created(comment);
    } catch (error) {
      next(error);
    }
  },

  async updateComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      const validatedData = updateCommentSchema.parse(req.body);
      const comment = await commentsStation.updateComment(
        gamingCenterId,
        req.actor!.id,
        id,
        validatedData as UpdateCommentDto
      );
      res.ok(comment);
    } catch (error) {
      next(error);
    }
  },

  async deleteComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      const isModerator = commentsPolicy.canModerate(req.actor!.role!);
      await commentsStation.deleteComment(gamingCenterId, req.actor!.id, id, isModerator);
      res.noContent();
    } catch (error) {
      next(error);
    }
  },

  async moderateComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      const isModerator = commentsPolicy.canModerate(req.actor!.role!);
      if (!isModerator) {
        throw new AppError('Only moderators can moderate comments.', httpStatus.FORBIDDEN);
      }
      const { status } = moderateCommentSchema.parse(req.body);
      const comment = await commentsStation.moderateComment(gamingCenterId, req.actor!.id, id, status);
      res.ok(comment);
    } catch (error) {
      next(error);
    }
  },

  async pinComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      const isModerator = commentsPolicy.canPin(req.actor!.role!);
      if (!isModerator) {
        throw new AppError('Only moderators can pin comments.', httpStatus.FORBIDDEN);
      }
      const { isPinned } = req.body;
      const comment = await commentsStation.pinComment(gamingCenterId, req.actor!.id, id, isPinned);
      res.ok(comment);
    } catch (error) {
      next(error);
    }
  },

  async flagComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      const comment = await commentsStation.flagComment(gamingCenterId, req.actor!.id, id);
      res.ok(comment);
    } catch (error) {
      next(error);
    }
  },

  async getComments(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId } = req.params;
      const validatedQuery = commentQuerySchema.parse(req.query);
      const result = await commentsStation.getComments(gamingCenterId, validatedQuery);
      res.ok(result);
    } catch (error) {
      next(error);
    }
  },

  async getCommentTree(req: Request, res: Response, next: NextFunction) {
    try {
      const gamingCenterId = req.gamingCenterId || req.params.gamingCenterId;
      const { postId, page = 1, pageSize = 10 } = req.query;
      if (!postId) {
        throw new AppError('postId is required.', httpStatus.BAD_REQUEST);
      }
      const result = await commentsStation.getCommentTree(
        gamingCenterId,
        postId as string,
        Number(page),
        Number(pageSize)
      );
      res.ok(result);
    } catch (error) {
      next(error);
    }
  },
};
