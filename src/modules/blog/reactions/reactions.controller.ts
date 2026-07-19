import { Request, Response, NextFunction } from 'express';
import { reactionsStation } from './reactions.station';
import { toggleReactionSchema } from './reactions.validation';
import { ToggleReactionDto } from './reactions.types';
import AppError from '../../../common/errors/AppError';
import httpStatus from 'http-status';

export const reactionsController = {
  async toggleReaction(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId } = req.params;
      const validatedData = toggleReactionSchema.parse(req.body);
      const result = await reactionsStation.toggleReaction(
        gamingCenterId,
        req.actor!.id,
        validatedData as ToggleReactionDto
      );
      res.ok(result);
    } catch (error) {
      next(error);
    }
  },

  async getAggregates(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId } = req.params;
      const { contentType, objectId } = req.query;
      if (!contentType || !objectId) {
        throw new AppError('contentType and objectId are required.', httpStatus.BAD_REQUEST);
      }
      const aggregates = await reactionsStation.getAggregates(
        gamingCenterId,
        contentType as string,
        objectId as string
      );
      res.ok(aggregates);
    } catch (error) {
      next(error);
    }
  },
};
