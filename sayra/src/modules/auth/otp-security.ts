import argon2 from 'argon2';
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

export const STATIC_OTP_CODE = '000000';

/**
 * Checks whether SKIP_OTP bypass is active.
 * Strict safety rule: NEVER active in production mode.
 */
export function isSkipOtp(): boolean {
  if (env.NODE_ENV === 'production') {
    return false;
  }
  return Boolean(env.SKIP_OTP);
}

/**
 * Returns the effective OTP code:
 * Returns static '000000' if SKIP_OTP is enabled (and not in production),
 * otherwise generates a cryptographically secure random numeric OTP.
 */
export function getEffectiveOtpCode(digits = 6): string {
  return isSkipOtp() ? STATIC_OTP_CODE : generateSecureNumericOtp(digits);
}

/**
 * Unified OTP code verification.
 * When SKIP_OTP is active, strictly requires '000000'.
 * When SKIP_OTP is inactive, verifies input against argon2 codeHash.
 */
export async function verifyOtpCode(inputCode: string, codeHash: string): Promise<boolean> {
  if (isSkipOtp()) {
    return inputCode === STATIC_OTP_CODE;
  }
  return argon2.verify(codeHash, inputCode);
}
