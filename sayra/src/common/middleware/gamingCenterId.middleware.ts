import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import { idSchema } from '../validators/common.validators';

const GamingCenterIdSchema = idSchema('Invalid gamingCenterId format');

export const gamingCenterIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const result = GamingCenterIdSchema.safeParse(req.params.gamingCenterId);

  if (!result.success) {
    throw new AppError('Invalid gamingCenter ID provided.', httpStatus.BAD_REQUEST);
  }

  req.gamingCenterId = result.data;
  next();
};
