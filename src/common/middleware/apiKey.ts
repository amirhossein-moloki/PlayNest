import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import AppError from '../errors/AppError';
import { env } from '../../config/env';

/**
 * Middleware to validate a static API key from the 'x-api-key' header.
 */
export const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== env.STATIC_API_KEY) {
    return next(new AppError('Invalid or missing API key', httpStatus.UNAUTHORIZED));
  }

  next();
};
