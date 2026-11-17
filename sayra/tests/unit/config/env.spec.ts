describe('Environment configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows ZIBAL_MERCHANT="zibal" in production mode', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_ACCESS_SECRET = 'a-very-long-production-access-secret-12345';
    process.env.JWT_REFRESH_SECRET = 'a-very-long-production-refresh-secret-12345';
    process.env.DEFAULT_PAYMENT_PROVIDER = 'ZIBAL';
    process.env.ZIBAL_MERCHANT = 'zibal';
    process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET = 'dummy-secret';

    expect(() => {
      // Re-require the env module unmocked
      jest.isolateModules(() => {
        const { env } = jest.requireActual('../../../src/config/env') as { env: { ZIBAL_MERCHANT: string; NODE_ENV: string } };
        expect(env.ZIBAL_MERCHANT).toBe('zibal');
        expect(env.NODE_ENV).toBe('production');
      });
    }).not.toThrow();
  });

  it('throws an error and blocks startup when NODE_ENV=production and SKIP_OTP=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_ACCESS_SECRET = 'a-very-long-production-access-secret-12345';
    process.env.JWT_REFRESH_SECRET = 'a-very-long-production-refresh-secret-12345';
    process.env.DEFAULT_PAYMENT_PROVIDER = 'ZIBAL';
    process.env.ZIBAL_MERCHANT = 'zibal';
    process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET = 'dummy-secret';
    process.env.SKIP_OTP = 'true';

    expect(() => {
      jest.isolateModules(() => {
        jest.requireActual('../../../src/config/env');
      });
    }).toThrow('FATAL: SKIP_OTP cannot be enabled in production (NODE_ENV=production). This bypass is for development and testing only.');
  });

  it('allows SKIP_OTP=true in development or test environments', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_ACCESS_SECRET = 'a-very-long-production-access-secret-12345';
    process.env.JWT_REFRESH_SECRET = 'a-very-long-production-refresh-secret-12345';
    process.env.DEFAULT_PAYMENT_PROVIDER = 'ZIBAL';
    process.env.ZIBAL_MERCHANT = 'zibal';
    process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET = 'dummy-secret';
    process.env.SKIP_OTP = 'true';

    expect(() => {
      jest.isolateModules(() => {
        const { env } = jest.requireActual('../../../src/config/env') as { env: { SKIP_OTP: boolean } };
        expect(env.SKIP_OTP).toBe(true);
      });
    }).not.toThrow();
  });
});
