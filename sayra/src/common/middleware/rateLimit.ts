import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import redis from '../../config/redis';
import { env } from '../../config/env';
import AppError from '../errors/AppError';

const mockMiddleware = (req: Request, res: Response, next: NextFunction) => next();

const rateLimitHandler = (
  _req: Request,
  _res: Response,
  next: NextFunction,
  options: { statusCode?: number; message?: unknown }
) => {
  const message =
    typeof options.message === 'string'
      ? options.message
      : 'Too many requests, please try again later.';
  next(
    new AppError(message, options.statusCode || httpStatus.TOO_MANY_REQUESTS, {
      code: 'TOO_MANY_REQUESTS',
    })
  );
};

const createStore = (prefix: string) => new RedisStore({
  prefix,
  // @ts-expect-error - Known issue with types compatibility between ioredis and rate-limit-redis
  sendCommand: (...args: string[]) => redis.call(...args),
});

// Custom key generator for public routes to limit requests per IP and per gamingCenter slug.
const publicApiKeyGenerator = (req: Request): string => {
  const { gamingCenterSlug } = req.params;
  const ip = req.ip || 'unknown';
  if (gamingCenterSlug && ip) {
    return `${ip}:${gamingCenterSlug}`;
  }
  return ip;
};

/**
 * Rate limiter for authenticated (private) API routes.
 */
export const privateApiRateLimiter = env.NODE_ENV === 'test'
  ? mockMiddleware
  : rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore('rl:private:'),
    validate: false,
    message: 'Too many requests for this session, please try again after 15 minutes',
    handler: rateLimitHandler,
  });

/**
 * Rate limiter for general public API GET routes.
 */
export const publicApiRateLimiter = env.NODE_ENV === 'test'
  ? mockMiddleware
  : rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore('rl:public:'),
    keyGenerator: publicApiKeyGenerator,
    validate: false,
    message: 'Too many requests from this IP for this gamingCenter, please try again after 15 minutes',
    handler: rateLimitHandler,
  });

/**
 * Strictest rate limiter for the public reservation creation endpoint.
 */
export const publicReservationRateLimiter = env.NODE_ENV === 'test'
  ? mockMiddleware
  : rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore('rl:res:'),
    keyGenerator: publicApiKeyGenerator,
    validate: false,
    message: 'Too many reservation attempts from this IP for this gamingCenter, please try again after 15 minutes',
    handler: rateLimitHandler,
  });

/**
 * Rate limiter for public analytics event ingestion endpoints.
 */
export const publicAnalyticsRateLimiter = env.NODE_ENV === 'test'
  ? mockMiddleware
  : rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore('rl:analytics:'),
    keyGenerator: publicApiKeyGenerator,
    validate: false,
    message: 'Too many analytics events from this IP, please try again later.',
    handler: rateLimitHandler,
  });
