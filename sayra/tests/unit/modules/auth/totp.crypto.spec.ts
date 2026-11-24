import {
  base32Decode,
  base32Encode,
  buildOtpAuthUri,
  decryptTotpSecret,
  encryptTotpSecret,
  formatManualEntryKey,
  generateRecoveryCodes,
  generateTotpCode,
  generateTotpQrCode,
  generateTotpSecret,
  getTotpTimeStep,
  hashRecoveryCode,
  RECOVERY_CODE_COUNT,
  resolveTotpMasterKey,
  verifyRecoveryCodeHash,
  verifyTotpCode,
} from '../../../../src/modules/auth/totp.crypto';

describe('TOTP Cryptography, AES-256-GCM & Recovery Codes (RFC 6238)', () => {
  // RFC 6238 Appendix B standard 20-byte ASCII test secret: "12345678901234567890"
  const rfcSecretBase32 = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

  it('encodes and decodes Base32 (RFC 4648) consistently', () => {
    expect(rfcSecretBase32).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    const decoded = base32Decode('gezd gnbv-gy3t qojq gezd gnbv gy3t qojq=');
    expect(decoded.toString('ascii')).toBe('12345678901234567890');
  });

  it('matches official RFC 6238 SHA-1 test vectors (8-digit and 6-digit)', () => {
    const vectors: Array<{ unixSec: number; expected8: string; expected6: string }> = [
      { unixSec: 59, expected8: '94287082', expected6: '287082' },
      { unixSec: 1111111109, expected8: '07081804', expected6: '081804' },
      { unixSec: 1111111111, expected8: '14050471', expected6: '050471' },
      { unixSec: 1234567890, expected8: '89005924', expected6: '005924' },
      { unixSec: 2000000000, expected8: '69279037', expected6: '279037' },
    ];

    for (const vec of vectors) {
      const tsMs = vec.unixSec * 1000;
      expect(generateTotpCode(rfcSecretBase32, tsMs, 30, 8)).toBe(vec.expected8);
      expect(generateTotpCode(rfcSecretBase32, tsMs, 30, 6)).toBe(vec.expected6);
    }
  });

  it('verifies codes within +/-1 step window, rejects expired codes, and blocks replay attacks', () => {
    const secret = generateTotpSecret();
    const baseTimeMs = 1_700_000_010_000; // deterministic timestamp
    const currentStep = getTotpTimeStep(baseTimeMs);

    const currentCode = generateTotpCode(secret, baseTimeMs);
    const prevStepCode = generateTotpCode(secret, baseTimeMs - 30_000);
    const expiredCode = generateTotpCode(secret, baseTimeMs - 90_000); // 3 steps behind

    expect(verifyTotpCode(secret, currentCode, { timestampMs: baseTimeMs })).toEqual({
      valid: true,
      matchedStep: currentStep,
    });

    expect(verifyTotpCode(secret, prevStepCode, { timestampMs: baseTimeMs })).toEqual({
      valid: true,
      matchedStep: currentStep - 1,
    });

    // Expired code (>1 step drift) is rejected
    expect(verifyTotpCode(secret, expiredCode, { timestampMs: baseTimeMs })).toEqual({
      valid: false,
    });

    // Replay of same or earlier step is rejected
    expect(
      verifyTotpCode(secret, currentCode, {
        timestampMs: baseTimeMs,
        lastUsedStep: currentStep,
      })
    ).toEqual({
      valid: false,
      matchedStep: currentStep,
      replayed: true,
    });

    expect(
      verifyTotpCode(secret, prevStepCode, {
        timestampMs: baseTimeMs,
        lastUsedStep: currentStep,
      })
    ).toEqual({
      valid: false,
      matchedStep: currentStep - 1,
      replayed: true,
    });
  });

  it('generates Google & Microsoft Authenticator compatible otpauth URI and offline QR code', async () => {
    const secret = generateTotpSecret();
    const manualKey = formatManualEntryKey(secret);
    expect(manualKey.replace(/\s+/g, '')).toBe(secret);

    const uri = buildOtpAuthUri({
      secret,
      accountName: 'superadmin',
      issuer: 'PlayNest',
    });

    expect(uri).toBe(
      `otpauth://totp/PlayNest:superadmin?secret=${secret}&issuer=PlayNest&algorithm=SHA1&digits=6&period=30`
    );

    const qr = await generateTotpQrCode(uri);
    expect(qr.svg).toContain('<svg');
    expect(qr.dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('encrypts and decrypts TOTP secrets with AES-256-GCM bound to PlatformAdmin ID via AAD', () => {
    const secret = generateTotpSecret();
    const adminId = 'pa_admin_123';

    const cipher1 = encryptTotpSecret(secret, adminId);
    const cipher2 = encryptTotpSecret(secret, adminId);

    // Random 96-bit IV guarantees distinct ciphertexts for identical secrets
    expect(cipher1).not.toBe(cipher2);
    expect(cipher1.startsWith('v1:')).toBe(true);
    expect(cipher1).not.toContain(secret);

    expect(decryptTotpSecret(cipher1, adminId)).toBe(secret);
    expect(decryptTotpSecret(cipher2, adminId)).toBe(secret);

    // Cross-admin decryption fails AAD verification
    expect(() => decryptTotpSecret(cipher1, 'pa_other_admin')).toThrow(
      'Unable to verify TOTP credentials due to a security service error.'
    );

    // Ciphertext tampering fails auth tag verification
    const parts = cipher1.split(':');
    const tamperedHex = (parts[3].startsWith('0') ? '1' : '0') + parts[3].slice(1);
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${tamperedHex}`;
    expect(() => decryptTotpSecret(tampered, adminId)).toThrow(
      'Unable to verify TOTP credentials due to a security service error.'
    );
  });

  it('fails closed in production when PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY is missing', () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origKey = process.env.PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY;
    try {
      process.env.NODE_ENV = 'production';
      process.env.PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY = '';

      expect(() => resolveTotpMasterKey()).toThrow(
        'TOTP encryption service is not configured.'
      );
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY = origKey;
    }
  });

  it('generates 10 unique recovery codes and verifies salted HMAC hashes securely', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);

    const sample = codes[0];
    expect(sample).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);

    const hash = hashRecoveryCode(sample);
    expect(hash.startsWith('rc_hmac256:')).toBe(true);
    expect(hash).not.toContain(sample.replace(/-/g, ''));

    // Accepts formatted, lowercase, and unhyphenated variants
    expect(verifyRecoveryCodeHash(sample, hash)).toBe(true);
    expect(verifyRecoveryCodeHash(sample.toLowerCase().replace(/-/g, ''), hash)).toBe(true);
    expect(verifyRecoveryCodeHash('0000-0000-0000-0000', hash)).toBe(false);
  });
});
