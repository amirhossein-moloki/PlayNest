import crypto from 'crypto';
import httpStatus from 'http-status';
import AppError from '../../common/errors/AppError';
import { env } from '../../config/env';
import { generateShortLinkQr } from '../short-links/qrCode.generator';

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_ALGORITHM = 'sha1' as const;
export const TOTP_DEFAULT_WINDOW = 1;
export const RECOVERY_CODE_COUNT = 10;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_LOOKUP: Record<string, number> = Object.fromEntries(
  BASE32_ALPHABET.split('').map((ch, idx) => [ch, idx])
);

const CIPHER_VERSION = 'v1';
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;

/**
 * Encodes a binary buffer to unpadded RFC 4648 Base32.
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes an RFC 4648 Base32 string (ignoring whitespace, hyphens, and '=' padding).
 */
export function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.replace(/[\s-=]/g, '').toUpperCase();
  if (!cleaned) {
    throw new Error('Base32 input is empty');
  }

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const idx = BASE32_LOOKUP[ch];
    if (idx === undefined) {
      throw new Error(`Invalid Base32 character: ${ch}`);
    }
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a cryptographically strong 160-bit Base32 TOTP secret (32 chars).
 * 160 bits is the RFC 4226 / RFC 6238 recommended secret length for HMAC-SHA1.
 */
export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(crypto.randomBytes(byteLength));
}

/**
 * Formats a Base32 secret into 4-character groups for manual authenticator entry.
 */
export function formatManualEntryKey(base32Secret: string): string {
  return base32Secret.replace(/[\s-]/g, '').toUpperCase().replace(/(.{4})(?=.)/g, '$1 ');
}

/**
 * Computes the current RFC 6238 time-step counter (T0 = 0).
 */
export function getTotpTimeStep(
  timestampMs = Date.now(),
  periodSeconds = TOTP_PERIOD_SECONDS
): number {
  return Math.floor(timestampMs / 1000 / periodSeconds);
}

/**
 * Generates an RFC 4226 HOTP code for a raw secret buffer and counter.
 */
export function generateHotpFromBuffer(
  secretBuffer: Buffer,
  counter: number,
  digits = TOTP_DIGITS
): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac(TOTP_ALGORITHM, secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const modulus = 10 ** digits;
  return (binary % modulus).toString().padStart(digits, '0');
}

/**
 * Generates an RFC 4226 HOTP code from a Base32 secret.
 */
export function generateHotpCode(
  secretBase32: string,
  counter: number,
  digits = TOTP_DIGITS
): string {
  return generateHotpFromBuffer(base32Decode(secretBase32), counter, digits);
}

/**
 * Generates an RFC 6238 TOTP code (SHA-1, 6 digits, 30s period).
 */
export function generateTotpCode(
  secretBase32: string,
  timestampMs = Date.now(),
  periodSeconds = TOTP_PERIOD_SECONDS,
  digits = TOTP_DIGITS
): string {
  const step = getTotpTimeStep(timestampMs, periodSeconds);
  return generateHotpCode(secretBase32, step, digits);
}

export interface VerifyTotpOptions {
  timestampMs?: number;
  periodSeconds?: number;
  digits?: number;
  window?: number;
  lastUsedStep?: number | null;
}

export interface VerifyTotpResult {
  valid: boolean;
  matchedStep?: number;
  replayed?: boolean;
}

/**
 * Verifies a 6-digit RFC 6238 TOTP code using constant-time comparison across
 * the configured time-step window and enforces replay protection via lastUsedStep.
 */
export function verifyTotpCode(
  secretBase32: string,
  rawCode: string,
  options: VerifyTotpOptions = {}
): VerifyTotpResult {
  const digits = options.digits ?? TOTP_DIGITS;
  const periodSeconds = options.periodSeconds ?? TOTP_PERIOD_SECONDS;
  const window = options.window ?? TOTP_DEFAULT_WINDOW;
  const timestampMs = options.timestampMs ?? Date.now();
  const lastUsedStep = options.lastUsedStep ?? null;

  const cleanedCode = String(rawCode || '').replace(/\s+/g, '');
  if (!new RegExp(`^\\d{${digits}}$`).test(cleanedCode)) {
    return { valid: false };
  }

  const secretBuffer = base32Decode(secretBase32);
  const currentStep = getTotpTimeStep(timestampMs, periodSeconds);
  const candidateBuf = Buffer.from(cleanedCode, 'utf8');

  let matchedStep: number | undefined;

  // Evaluate every step in the window without early return to reduce timing side channels
  for (let delta = -window; delta <= window; delta++) {
    const step = currentStep + delta;
    if (step < 0) continue;
    const expected = generateHotpFromBuffer(secretBuffer, step, digits);
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (
      expectedBuf.length === candidateBuf.length &&
      crypto.timingSafeEqual(expectedBuf, candidateBuf)
    ) {
      if (matchedStep === undefined) {
        matchedStep = step;
      }
    }
  }

  if (matchedStep === undefined) {
    return { valid: false };
  }

  if (lastUsedStep !== null && matchedStep <= lastUsedStep) {
    return { valid: false, matchedStep, replayed: true };
  }

  return { valid: true, matchedStep };
}

/**
 * Builds a standard otpauth:// URI compatible with Google Authenticator and Microsoft Authenticator.
 */
export function buildOtpAuthUri(params: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = (params.issuer || env.PLATFORM_ADMIN_TOTP_ISSUER || 'PlayNest').trim().slice(0, 40);
  const accountName = params.accountName.trim().slice(0, 64);
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  const cleanSecret = params.secret.replace(/[\s-=]/g, '').toUpperCase();

  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${cleanSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
}

/**
 * Generates an offline ISO/IEC 18004 QR code (SVG + SVG data URL) for an otpauth:// URI.
 */
export async function generateTotpQrCode(
  otpauthUrl: string
): Promise<{ svg: string; dataUrl: string }> {
  const qr = await generateShortLinkQr(otpauthUrl, {
    format: 'json',
    size: 280,
    margin: 4,
    errorCorrectionLevel: 'M',
    foreground: '#111827',
    background: '#FFFFFF',
  });

  if (!qr.svg || !qr.dataUrl) {
    throw new AppError(
      'Unable to generate 2FA enrollment QR code.',
      httpStatus.SERVICE_UNAVAILABLE,
      { code: 'TOTP_SERVICE_UNAVAILABLE' }
    );
  }

  return {
    svg: qr.svg,
    dataUrl: qr.dataUrl,
  };
}

/**
 * Resolves the 32-byte master encryption key for AES-256-GCM TOTP secrets.
 * Fails closed in production if PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY is missing or placeholder.
 */
export function resolveTotpMasterKey(): Buffer {
  const nodeEnv = process.env.NODE_ENV || env.NODE_ENV;
  const rawKey = (
    process.env.PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY ??
    env.PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY ??
    ''
  ).trim();

  if (nodeEnv === 'production') {
    if (
      !rawKey ||
      rawKey.length < 32 ||
      rawKey.includes('<YOUR_TOTP_ENCRYPTION_KEY')
    ) {
      throw new AppError(
        'TOTP encryption service is not configured. Platform administrator authentication is disabled until configured.',
        httpStatus.SERVICE_UNAVAILABLE,
        { code: 'TOTP_SERVICE_UNAVAILABLE' }
      );
    }
  }

  if (rawKey) {
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      return Buffer.from(rawKey, 'hex');
    }
    return crypto.createHash('sha256').update(`playnest-totp-key-v1:${rawKey}`, 'utf8').digest();
  }

  // Non-production fallback only (development / test)
  const fallbackSecret = process.env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET;
  return crypto
    .createHash('sha256')
    .update(`playnest-dev-totp-aes-256-gcm-v1:${fallbackSecret}`, 'utf8')
    .digest();
}

/**
 * Encrypts a Base32 TOTP secret using AES-256-GCM bound via AAD to the PlatformAdmin ID.
 */
export function encryptTotpSecret(plainBase32Secret: string, platformAdminId: string): string {
  const key = resolveTotpMasterKey();
  const iv = crypto.randomBytes(AES_GCM_IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
    authTagLength: AES_GCM_TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(`platform-admin-totp:${platformAdminId}`, 'utf8'));

  const ciphertext = Buffer.concat([
    cipher.update(plainBase32Secret, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${CIPHER_VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted TOTP secret and verifies authenticity tag & AAD.
 * Fails closed on any decryption, authentication, or configuration error.
 */
export function decryptTotpSecret(encryptedPayload: string, platformAdminId: string): string {
  const key = resolveTotpMasterKey();

  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 4 || parts[0] !== CIPHER_VERSION) {
      throw new Error('Unsupported encrypted secret format');
    }

    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const ciphertext = Buffer.from(parts[3], 'hex');

    if (iv.length !== AES_GCM_IV_BYTES || authTag.length !== AES_GCM_TAG_BYTES || ciphertext.length === 0) {
      throw new Error('Malformed encrypted secret payload');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, {
      authTagLength: AES_GCM_TAG_BYTES,
    });
    decipher.setAAD(Buffer.from(`platform-admin-totp:${platformAdminId}`, 'utf8'));
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    if (!plaintext) {
      throw new Error('Empty decrypted secret');
    }

    return plaintext;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError(
      'Unable to verify TOTP credentials due to a security service error.',
      httpStatus.SERVICE_UNAVAILABLE,
      { code: 'TOTP_SERVICE_UNAVAILABLE' }
    );
  }
}

/**
 * Normalizes a recovery code by stripping whitespace/hyphens and uppercasing.
 */
export function normalizeRecoveryCode(input: string): string {
  return String(input || '').replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Generates N cryptographically random single-use recovery codes (64 bits entropy each).
 * Formatted as XXXX-XXXX-XXXX-XXXX for readable backup storage.
 */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    const raw = crypto.randomBytes(8).toString('hex').toUpperCase();
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
    codes.add(formatted);
  }
  return Array.from(codes);
}

/**
 * Hashes a recovery code with a random 128-bit salt and server-keyed HMAC-SHA256.
 */
export function hashRecoveryCode(plainCode: string): string {
  const key = resolveTotpMasterKey();
  const normalized = normalizeRecoveryCode(plainCode);
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto
    .createHmac('sha256', key)
    .update(`recovery-code-v1:${salt}:${normalized}`, 'utf8')
    .digest('hex');

  return `rc_hmac256:${salt}:${digest}`;
}

/**
 * Verifies a plaintext recovery code against a stored salted HMAC hash in constant time.
 */
export function verifyRecoveryCodeHash(plainCode: string, storedHash: string): boolean {
  const normalized = normalizeRecoveryCode(plainCode);
  if (!normalized || !storedHash) {
    return false;
  }

  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'rc_hmac256') {
    return false;
  }

  const [, salt, expectedDigest] = parts;
  if (!salt || !expectedDigest) {
    return false;
  }

  const key = resolveTotpMasterKey();
  const actualDigest = crypto
    .createHmac('sha256', key)
    .update(`recovery-code-v1:${salt}:${normalized}`, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expectedDigest, 'hex');
  const actualBuf = Buffer.from(actualDigest, 'hex');
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
