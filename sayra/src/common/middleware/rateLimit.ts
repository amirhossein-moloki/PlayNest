import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import redis from '../../config/redis';
import { env } from '../../config/env';
import AppError from '../errors/AppError';

function matchesSecretHeader(actualHeader: unknown, expectedSecret?: string): boolean {
  if (!expectedSecret || typeof actualHeader !== 'string') {
    return false;
  }
  const trimmedActual = actualHeader.trim();
  const trimmedExpected = expectedSecret.trim();
  if (!trimmedActual || !trimmedExpected) {
    return false;
  }
  const actualBuf = Buffer.from(trimmedActual, 'utf8');
  const expectedBuf = Buffer.from(trimmedExpected, 'utf8');
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

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
    skip: (req: Request) => {
      const ssrSecret = process.env.INTERNAL_SSR_SECRET || env.INTERNAL_SSR_SECRET;
      if (matchesSecretHeader(req.headers['x-ssr-secret'], ssrSecret)) {
        return true;
      }
      const serviceToken = process.env.INTERNAL_SERVICE_TOKEN || env.INTERNAL_SERVICE_TOKEN;
      if (matchesSecretHeader(req.headers['x-service-token'], serviceToken)) {
        return true;
      }
      return false;
    },
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

export interface ShortLinkRateLimiterOptions {
  windowMs: number;
  max: number;
  prefix: string;
  message: string;
  forceEnableInTest?: boolean;
}

/**
 * Factory for short-link redirect, creation, and QR endpoints.
 * Falls back to MemoryStore in test mode when forceEnableInTest is true.
 */
export function createShortLinkRateLimiter(options: ShortLinkRateLimiterOptions) {
  if (env.NODE_ENV === 'test' && !options.forceEnableInTest) {
    return mockMiddleware;
  }

  const useMemory = Boolean(options.forceEnableInTest) || env.RATE_LIMIT_STORE === 'memory';
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    ...(useMemory ? {} : { store: createStore(options.prefix) }),
    validate: false,
    message: options.message,
    handler: rateLimitHandler,
  });
}

export const shortLinkRedirectRateLimiter = createShortLinkRateLimiter({
  windowMs: 60 * 1000,
  max: env.SHORT_LINK_REDIRECT_RATE_LIMIT_MAX || 120,
  prefix: 'rl:shortlink:r:',
  message: 'Too many redirect requests from this IP, please slow down.',
});

export const shortLinkCreateRateLimiter = createShortLinkRateLimiter({
  windowMs: 60 * 1000,
  max: env.SHORT_LINK_CREATE_RATE_LIMIT_MAX || 30,
  prefix: 'rl:shortlink:create:',
  message: 'Too many short link creations, please try again shortly.',
});

export const shortLinkQrRateLimiter = createShortLinkRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  prefix: 'rl:shortlink:qr:',
  message: 'Too many QR code requests, please try again shortly.',
});
