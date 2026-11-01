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
    const { redis } = await import('../src/config/redis');
    if (redis && redis.status !== 'end') {
      redis.disconnect(false);
    }
  } catch {
    // Ignore
  }
});
