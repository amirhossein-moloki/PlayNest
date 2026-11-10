import crypto from 'crypto';
import redis from '../../config/redis';
import logger from '../../config/logger';
import { env } from '../../config/env';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

interface MemoryRateLimitRecord {
  count: number;
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryRateLimitRecord>();

const cleanupMemoryStore = () => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (record.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
};

/**
 * Increment rate limiter counter and enforce max limit.
 * Uses Redis with an in-memory fallback.
 */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  errorMessage: string
): Promise<void> {
  if (env.NODE_ENV === 'test') {
    return;
  }

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    if (current > limit) {
      const ttl = await redis.ttl(key);
      logger.warn({ key, current, limit, ttl }, 'Rate limit exceeded (Redis)');
      throw new AppError(errorMessage, httpStatus.TOO_MANY_REQUESTS);
    }
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    logger.warn({ err, key }, 'Redis error in enforceRateLimit, using memory fallback');
    cleanupMemoryStore();
    const now = Date.now();
    const record = memoryStore.get(key);
    if (!record || record.expiresAt <= now) {
      memoryStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    } else {
      record.count += 1;
      if (record.count > limit) {
        logger.warn({ key, count: record.count, limit }, 'Rate limit exceeded (Memory fallback)');
        throw new AppError(errorMessage, httpStatus.TOO_MANY_REQUESTS);
      }
    }
  }
}

/**
 * Generate a cryptographically secure 6-digit numeric OTP string.
 */
export function generateSecureNumericOtp(digits = 6): string {
  const min = Math.pow(10, digits - 1); // e.g. 100000
  const max = Math.pow(10, digits); // e.g. 1000000
  const code = crypto.randomInt(min, max);
  return code.toString();
}

/**
 * Progressive backoff delay for failed attempts (e.g. 100ms, 200ms, 400ms...)
 */
export async function progressiveDelay(failedAttempts: number): Promise<void> {
  if (failedAttempts <= 0 || env.NODE_ENV === 'test') {
    return;
  }
  const delayMs = Math.min(1000, Math.pow(2, failedAttempts) * 50);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
