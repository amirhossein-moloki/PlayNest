import { describe, it, expect, jest } from '@jest/globals';

describe('env configuration in production with SKIP_OTP', () => {
  it('should allow SKIP_OTP=true in production environment without throwing an error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Save previous environment variables
    const prevEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.SKIP_OTP = 'true';
      process.env.JWT_ACCESS_SECRET = 'a_secure_random_jwt_access_secret_longer_than_32_chars';
      process.env.JWT_REFRESH_SECRET = 'a_secure_random_jwt_refresh_secret_longer_than_32_chars';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET = 'whsec_dummy';

      // Unmock ../../../src/config/env which was mocked in tests/setup.ts
      jest.unmock('../../../src/config/env');
      jest.resetModules();
      const { env } = await import('../../../src/config/env');

      expect(env.NODE_ENV).toBe('production');
      expect(env.SKIP_OTP).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SKIP_OTP is enabled in production environment')
      );
    } finally {
      // Re-apply env mock so afterAll hooks in tests/setup.ts don't fail when importing prisma/workers
      jest.mock('../../../src/config/env', () => ({
        env: {
          NODE_ENV: 'test',
          JWT_SECRET: 't',
          JWT_ACCESS_SECRET: 't',
          JWT_ACCESS_EXPIRES_IN: '15m',
          SMSIR_OTP_TEMPLATE_ID: 123456,
          LOG_LEVEL: 'silent',
          DEFAULT_PAYMENT_PROVIDER: 'ZARINPAL',
          ZARINPAL_MERCHANT_ID: '00000000-0000-0000-0000-000000000000',
          ZARINPAL_CALLBACK_URL: 'http://localhost:3000/api/v1/payments/callback',
          ZARINPAL_SANDBOX: true,
          ZIBAL_MERCHANT: 'zibal',
          ZIBAL_CALLBACK_URL: 'http://localhost:3000/api/v1/payments/zibal/callback',
        },
      }));
      process.env = prevEnv;
      warnSpy.mockRestore();
    }
  });
});
