/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest } from '@jest/globals';

describe('SEC-013 (Sayra): Production Env & Admin Secret Fail-Fast Guards', () => {
  it('validateAdminSecrets allows dev fallbacks in test/dev but rejects missing or default secrets in production', async () => {
    const { validateAdminSecrets } = await jest.requireActual<any>(
      '../../src/platform-admin/config/admin.constants'
    );

    expect(() => validateAdminSecrets({ NODE_ENV: 'development' })).not.toThrow();

    expect(() =>
      validateAdminSecrets({
        NODE_ENV: 'production',
        ADMIN_SESSION_SECRET: '',
        ADMIN_COOKIE_SECRET: 'a-very-strong-production-cookie-secret-key-32+',
      })
    ).toThrow(/ADMIN_SESSION_SECRET/);

    expect(() =>
      validateAdminSecrets({
        NODE_ENV: 'production',
        ADMIN_SESSION_SECRET: 'playnest-platform-admin-panel-secret-session-key-32',
        ADMIN_COOKIE_SECRET: 'a-very-strong-production-cookie-secret-key-32+',
      })
    ).toThrow(/ADMIN_SESSION_SECRET/);

    expect(() =>
      validateAdminSecrets({
        NODE_ENV: 'production',
        ADMIN_SESSION_SECRET: 'a-very-strong-production-session-secret-key-32+',
        ADMIN_COOKIE_SECRET: 'playnest-cookie-secret-key-at-least-32-characters-long',
      })
    ).toThrow(/ADMIN_COOKIE_SECRET/);

    const valid = validateAdminSecrets({
      NODE_ENV: 'production',
      ADMIN_SESSION_SECRET: 'prod-session-secret-with-more-than-32-characters',
      ADMIN_COOKIE_SECRET: 'prod-cookie-secret-with-more-than-32-characters!',
    });
    expect(valid.sessionSecret).toBe('prod-session-secret-with-more-than-32-characters');
  });

  it('validateProductionEnv rejects sandbox ZIBAL_MERCHANT, placeholder SSR/JWT secrets, and SKIP_OTP in production', async () => {
    const prevEnv = {
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      PAYMENT_PROVIDER_WEBHOOK_SECRET: process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET,
    };
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET || 'test_access_secret_at_least_32_characters_long';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_at_least_32_characters_long';
    process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET =
      process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET || 'test-webhook-secret';

    try {
      const envMod = await jest.requireActual<any>('../../src/config/env');
      const validateProductionEnv = envMod.validateProductionEnv as (d: any) => void;

      const baseProdEnv = {
        NODE_ENV: 'production',
        MEDIA_STORAGE_DRIVER: 'local',
        SKIP_OTP: false,
        JWT_ACCESS_SECRET: 'prod_access_secret_at_least_32_characters_long_1234',
        JWT_REFRESH_SECRET: 'prod_refresh_secret_at_least_32_characters_long_1234',
        PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        PAYMENT_PROVIDER_WEBHOOK_SECRET: 'strong-production-webhook-secret-1234',
        DEFAULT_PAYMENT_PROVIDER: 'ZIBAL',
        ZIBAL_MERCHANT: 'real-zibal-merchant-id',
        ZARINPAL_SANDBOX: false,
        INTERNAL_SSR_SECRET: 'strong-production-ssr-secret-value',
      };

      expect(() => validateProductionEnv(baseProdEnv)).not.toThrow();

      expect(() =>
        validateProductionEnv({ ...baseProdEnv, ZIBAL_MERCHANT: 'zibal' })
      ).toThrow(/ZIBAL_MERCHANT/);

      expect(() =>
        validateProductionEnv({
          ...baseProdEnv,
          DEFAULT_PAYMENT_PROVIDER: 'ZARINPAL',
          ZARINPAL_SANDBOX: true,
        })
      ).toThrow(/ZARINPAL_SANDBOX/);

      expect(() =>
        validateProductionEnv({
          ...baseProdEnv,
          INTERNAL_SSR_SECRET: '__disabled_ssr_secret_never_match__',
        })
      ).toThrow(/INTERNAL_SSR_SECRET/);

      expect(() =>
        validateProductionEnv({ ...baseProdEnv, PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY: undefined })
      ).toThrow(/PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY/);

      expect(() =>
        validateProductionEnv({ ...baseProdEnv, SKIP_OTP: true })
      ).toThrow(/SKIP_OTP/);
    } finally {
      for (const [k, v] of Object.entries(prevEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
