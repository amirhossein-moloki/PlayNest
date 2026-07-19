import { Request, Response } from 'express';
import { commentsStation } from './comments.station';
import { createCommentSchema, updateCommentSchema, moderateCommentSchema, commentQuerySchema } from './comments.validation';
import { commentsPolicy } from './comments.policy';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { CreateCommentDto, UpdateCommentDto } from './comments.types';

export const commentsController = {
  async createComment(req: Request, res: Response) {
    const { gamingCenterId } = req.params;
    const userId = req.actor!.id;
    const validatedData = createCommentSchema.parse(req.body) as CreateCommentDto;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    const comment = await commentsStation.createComment(gamingCenterId, userId, validatedData, ip, userAgent);
    res.status(httpStatus.CREATED).ok(comment);
  },

  async updateComment(req: Request, res: Response) {
    const { gamingCenterId, id } = req.params;
    const userId = req.actor!.id;
    const validatedData = updateCommentSchema.parse(req.body) as UpdateCommentDto;

    const comment = await commentsStation.updateComment(gamingCenterId, userId, id, validatedData);
    res.ok(comment);
  },

  async deleteComment(req: Request, res: Response) {
    const { gamingCenterId, id } = req.params;
    const userId = req.actor!.id;
    const role = req.actor!.role;
    const isModerator = role ? commentsPolicy.canModerate(role) : false;

    const comment = await commentsStation.deleteComment(gamingCenterId, userId, id, isModerator);
    res.ok(comment);
  },

  async moderateComment(req: Request, res: Response) {
    const { gamingCenterId, id } = req.params;
    const moderatorId = req.actor!.id;
    const role = req.actor!.role;

    if (!role || !commentsPolicy.canModerate(role)) {
      throw new AppError('You do not have permission to moderate comments.', httpStatus.FORBIDDEN);
    }

    const { status } = moderateCommentSchema.parse(req.body);
    const comment = await commentsStation.moderateComment(gamingCenterId, moderatorId, id, status);
    res.ok(comment);
  },

  async pinComment(req: Request, res: Response) {
    const { gamingCenterId, id } = req.params;
    const moderatorId = req.actor!.id;
    const role = req.actor!.role;

    if (!role || !commentsPolicy.canPin(role)) {
      throw new AppError('You do not have permission to pin comments.', httpStatus.FORBIDDEN);
    }

    const { isPinned } = req.body;
    const comment = await commentsStation.pinComment(gamingCenterId, moderatorId, id, !!isPinned);
    res.ok(comment);
  },

  async flagComment(req: Request, res: Response) {
    const { gamingCenterId, id } = req.params;
    const userId = req.actor!.id;

    const comment = await commentsStation.flagComment(gamingCenterId, userId, id);
    res.ok(comment);
  },

  async getComments(req: Request, res: Response) {
    const { gamingCenterId } = req.params;
    const validatedQuery = commentQuerySchema.parse(req.query);

    const result = await commentsStation.getComments(gamingCenterId, validatedQuery);
    res.ok(result);
  },

  async getCommentTree(req: Request, res: Response) {
    const { gamingCenterId } = req.params;
    const { postId } = req.query;
    if (!postId || typeof postId !== 'string') {
      throw new AppError('postId is required', httpStatus.BAD_REQUEST);
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await commentsStation.getCommentTree(gamingCenterId, postId, page, pageSize);
    res.ok(result);
  }
};
