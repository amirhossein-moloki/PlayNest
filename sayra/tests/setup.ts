// tests/setup.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/playenest_test';

import { jest, afterAll } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */
(global as any).jest = jest;
/* eslint-enable @typescript-eslint/no-explicit-any */

jest.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 't',
    JWT_ACCESS_SECRET: 't',
    JWT_ACCESS_EXPIRES_IN: '15m',
    SMSIR_OTP_TEMPLATE_ID: 123456,
    LOG_LEVEL: 'silent',
    DEFAULT_PAYMENT_PROVIDER: 'ZIBAL',
    ZARINPAL_MERCHANT_ID: '00000000-0000-0000-0000-000000000000',
    ZARINPAL_CALLBACK_URL: 'http://localhost:3000/api/v1/payments/callback',
    ZARINPAL_SANDBOX: true,
    ZIBAL_MERCHANT: 'zibal',
    ZIBAL_CALLBACK_URL: 'https://api.sayra-booking.ir/api/v1/payments/zibal/callback',
    FRONTEND_URL: 'https://sayra-booking.ir',
    PAYMENT_SUCCESS_URL: 'https://sayra-booking.ir/payment/success',
    PAYMENT_FAILED_URL: 'https://sayra-booking.ir/payment/failed',
    INTERNAL_SSR_SECRET: 'test-ssr-secret',
    INTERNAL_SERVICE_TOKEN: 'test-service-token',
    RANKING_BAYESIAN_M: 3,
    RANKING_MIN_REVIEWS_DEFAULT: 3,
    BLOG_WEBHOOK_URL: '',
    BLOG_WEBHOOK_SECRET: 'test-webhook-secret',
    INTEGRATION_OUTBOX_POLL_INTERVAL_MS: 10000,
    INTEGRATION_OUTBOX_BATCH_SIZE: 25,
    INTEGRATION_OUTBOX_ENABLED: false,
    SHORT_LINK_BASE_URL: 'https://sayra-booking.ir/r',
    SHORT_LINK_CODE_LENGTH: 7,
    SHORT_LINK_EXTERNAL_POLICY: 'ALLOWLIST_ONLY',
    SHORT_LINK_ALLOWED_DOMAINS: '',
    SHORT_LINK_PRIVACY_SALT: 'test-short-link-salt',
    SHORT_LINK_DEDUP_WINDOW_SECONDS: 300,
    SHORT_LINK_BURST_MAX_CLICKS_PER_MINUTE: 20,
    SHORT_LINK_MAX_PER_CENTER: 500,
    SHORT_LINK_REDIRECT_RATE_LIMIT_MAX: 120,
    SHORT_LINK_CREATE_RATE_LIMIT_MAX: 30,
  },
}));

jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock('../src/config/redis', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
  const { EventEmitter } = require('events');
  const mockRedis: any = new EventEmitter();
  mockRedis.status = 'ready';
  mockRedis.get = ((jest as any).fn() as any).mockResolvedValue(null);
  mockRedis.set = ((jest as any).fn() as any).mockResolvedValue('OK');
  mockRedis.del = ((jest as any).fn() as any).mockResolvedValue(1);
  mockRedis.quit = ((jest as any).fn() as any).mockResolvedValue('OK');
  mockRedis.disconnect = (jest as any).fn();
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
  return {
    __esModule: true,
    redis: mockRedis,
    default: mockRedis,
  };
});

afterAll(async () => {
  try {
    const { disconnectPrisma } = await import('../src/config/prisma');
    await disconnectPrisma();
  } catch {
    // Ignore error if not imported
  }

  try {
    const { reservationExpiryWorker } = await import('../src/jobs/workers/reservationExpiry.worker');
    if (reservationExpiryWorker?.isRunning()) {
      await reservationExpiryWorker.stop();
    }
  } catch {
    // Ignore
  }

  try {
    const { waitlistExpiryWorker } = await import('../src/jobs/workers/waitlistExpiry.worker');
    if (waitlistExpiryWorker?.isRunning()) {
      await waitlistExpiryWorker.stop();
    }
  } catch {
    // Ignore
  }

  try {
    const { reservationRemindersWorker } = await import('../src/jobs/workers/reservationReminders.worker');
    if (reservationRemindersWorker?.isRunning()) {
      await reservationRemindersWorker.stop();
    }
  } catch {
    // Ignore
  }

  try {
    const { integrationWebhookWorker } = await import('../src/jobs/workers/integrationWebhook.worker');
    if (integrationWebhookWorker?.isRunning()) {
      await integrationWebhookWorker.stop();
    }
  } catch {
    // Ignore
  }

  try {
    const { redis } = await import('../src/config/redis');
    if (redis && redis.status !== 'end') {
      redis.disconnect(false);
    }
  } catch {
    // Ignore
  }
});
