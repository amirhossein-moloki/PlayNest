// tests/setup.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

import { jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */
(global as any).jest = jest;
/* eslint-enable @typescript-eslint/no-explicit-any */

jest.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 't',
    JWT_ACCESS_SECRET: 't',
    STATIC_API_KEY: 'test-static-api-key-at-least-10-chars',
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
