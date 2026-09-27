import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import AppError from '../errors/AppError';
import { env } from '../../config/env';

/**
 * Middleware to validate a static API key from the 'x-api-key' header.
 *
 * NOTE ON API KEY USAGE:
 * The static API key (`x-api-key`) is intended for service-to-service / backend-to-backend authentication
 * or protecting internal API endpoints.
 * It SHOULD NOT be exposed in client-side / browser applications (which should instead use
 * JWT Bearer Tokens for user/customer session authentication).
 */
export const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== env.STATIC_API_KEY) {
    return next(new AppError('Invalid or missing API key', httpStatus.UNAUTHORIZED));
  }

  next();
};
