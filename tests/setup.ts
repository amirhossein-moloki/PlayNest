// tests/setup.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

import { jest } from '@jest/globals';

// @ts-ignore
global.jest = jest;

jest.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret',
    JWT_ACCESS_SECRET: 'access-secret',
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
