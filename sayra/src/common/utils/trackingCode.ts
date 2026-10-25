import crypto from 'crypto';

/**
 * Unambiguous 31-character uppercase alphanumeric alphabet.
 * Excludes ambiguous visual characters: '0', 'O', '1', 'I', 'L'.
 */
export const TRACKING_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const TRACKING_CODE_LENGTH = 8;

/**
 * Effective Entropy Calculation:
 * - Search space size = 31^8 = 852,891,037,441 (8.53 x 10^11 possibilities)
 * - Bits of entropy = log2(31^8) ≈ 39.63 bits
 * - With API rate limiting (e.g., max 30 lookup attempts / 15 mins), guessing a code by brute force
 *   has an infinitesimal probability (< 3.6 x 10^-11 per attempt).
 */

/**
 * Generates a cryptographically secure random tracking code.
 */
export function generateTrackingCode(): string {
  const bytes = crypto.randomBytes(TRACKING_CODE_LENGTH);
  let result = '';
  const alphabetLength = TRACKING_CODE_ALPHABET.length;

  for (let i = 0; i < TRACKING_CODE_LENGTH; i++) {
    // Rejection sampling or modulo mapping
    const index = bytes[i] % alphabetLength;
    result += TRACKING_CODE_ALPHABET[index];
  }

  return result;
}

/**
 * Normalizes user input for tracking code lookups.
 * Converts to uppercase, trims, and strips whitespace/hyphens.
 */
export function normalizeTrackingCode(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Validates whether normalized input is a potentially valid tracking code.
 */
export function isValidTrackingCodeFormat(input: string): boolean {
  const normalized = normalizeTrackingCode(input);
  if (!normalized || normalized.length < 4 || normalized.length > 32) {
    return false;
  }
  return true;
}
