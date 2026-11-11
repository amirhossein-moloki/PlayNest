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
        const { env } = jest.requireActual('../../../src/config/env') as any;
        expect(env.ZIBAL_MERCHANT).toBe('zibal');
        expect(env.NODE_ENV).toBe('production');
      });
    }).not.toThrow();
  });
});
