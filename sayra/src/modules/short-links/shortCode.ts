import crypto from 'crypto';
import httpStatus from 'http-status';
import { env } from '../../config/env';
import AppError from '../../common/errors/AppError';

const SHORT_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SHORT_CODE_FORMAT_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,62}[a-zA-Z0-9]$/;

export const RESERVED_SHORT_CODES = new Set<string>([
  'api',
  'api-docs',
  'admin',
  'platform-admin',
  'platform-admin-panel',
  'auth',
  'login',
  'logout',
  'register',
  'signup',
  'health',
  'docs',
  'swagger',
  'redoc',
  'redoc-assets',
  'openapi',
  'openapi.json',
  'openapi.yaml',
  'static',
  'media',
  'uploads',
  'storage',
  'robots',
  'robots.txt',
  'favicon',
  'favicon.ico',
  'short-links',
  'short-link-campaigns',
  'campaigns',
  'qr',
  'stats',
  'analytics',
  'webhooks',
  'payments',
  'gamecenter',
  'gamecenters',
  'gamingcenters',
  'gaming-centers',
  'blog',
  'search',
  'public',
  'customer',
  'customers',
  'support',
  'tickets',
  'reservations',
  'availability',
  'r',
  's',
]);

/**
 * Normalizes a short code for case-insensitive uniqueness and lookup matching.
 */
export function normalizeShortCode(code: string): string {
  return String(code || '').trim().toLowerCase();
}

/**
 * Checks whether a candidate code meets URL-safe character & length bounds (3..64 chars).
 */
export function isValidShortCodeFormat(code: string): boolean {
  const trimmed = String(code || '').trim();
  if (trimmed.length < 3 || trimmed.length > 64) {
    return false;
  }
  return SHORT_CODE_FORMAT_REGEX.test(trimmed);
}

/**
 * Generates a cryptographically random URL-safe code using rejection sampling over Base58.
 */
export function generateShortCode(length = env.SHORT_LINK_CODE_LENGTH || 7): string {
  const targetLen = Math.max(6, Math.min(16, Math.floor(length)));
  const alphabetLen = SHORT_CODE_ALPHABET.length; // 58
  const maxUnbiasedByte = 256 - (256 % alphabetLen); // 232

  let result = '';
  while (result.length < targetLen) {
    const bytes = crypto.randomBytes((targetLen - result.length) * 2);
    for (let i = 0; i < bytes.length && result.length < targetLen; i += 1) {
      const b = bytes[i];
      if (b < maxUnbiasedByte) {
        result += SHORT_CODE_ALPHABET[b % alphabetLen];
      }
    }
  }
  return result;
}

/**
 * Validates user-supplied custom aliases, blocking invalid syntax and system-reserved paths.
 */
export function validateCustomCode(rawCode: string): { code: string; normalizedCode: string } {
  const code = String(rawCode || '').trim();
  if (!isValidShortCodeFormat(code)) {
    throw new AppError(
      'Custom short code must be 3-64 characters using letters, numbers, hyphens, or underscores, and must start and end with an alphanumeric character.',
      httpStatus.BAD_REQUEST,
      { code: 'INVALID_SHORT_CODE' }
    );
  }

  const normalizedCode = normalizeShortCode(code);
  if (RESERVED_SHORT_CODES.has(normalizedCode)) {
    throw new AppError(
      `The short code "${code}" is reserved by the platform.`,
      httpStatus.BAD_REQUEST,
      { code: 'RESERVED_SHORT_CODE' }
    );
  }

  return { code, normalizedCode };
}

/**
 * Builds the canonical external short URL for redirects and QR generation.
 */
export function buildShortUrl(code: string): string {
  const base = (env.SHORT_LINK_BASE_URL || 'https://sayra-booking.ir/r').replace(/\/+$/, '');
  return `${base}/${encodeURIComponent(code)}`;
}
