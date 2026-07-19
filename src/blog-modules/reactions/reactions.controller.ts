import { Request, Response } from 'express';
import { reactionsStation } from './reactions.station';
import { toggleReactionSchema } from './reactions.validation';
import { ToggleReactionDto } from './reactions.types';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export const reactionsController = {
  async toggleReaction(req: Request, res: Response) {
    const { gamingCenterId } = req.params;
    const userId = req.actor!.id;
    const validatedData = toggleReactionSchema.parse(req.body) as ToggleReactionDto;

    const result = await reactionsStation.toggleReaction(gamingCenterId, userId, validatedData);
    res.ok(result);
  },

  async getAggregates(req: Request, res: Response) {
    const { gamingCenterId } = req.params;
    const { contentType, objectId } = req.query;
    if (!contentType || !objectId || typeof contentType !== 'string' || typeof objectId !== 'string') {
      throw new AppError('contentType and objectId are required', httpStatus.BAD_REQUEST);
    }

    const aggregates = await reactionsStation.getAggregates(gamingCenterId, contentType, objectId);
    res.ok(aggregates);
  }
};
