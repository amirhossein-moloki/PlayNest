import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
import { jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */
(global as any).jest = jest;
/* eslint-enable @typescript-eslint/no-explicit-any */

import * as prismaEnums from './mocks/prisma-enums';
Object.assign(global, prismaEnums);

jest.mock('../src/config/env', () => ({
  env: { NODE_ENV: 'test', JWT_SECRET: 't', JWT_ACCESS_SECRET: 't', JWT_ACCESS_EXPIRES_IN: '15m', SMSIR_OTP_TEMPLATE_ID: 123456, LOG_LEVEL: 'silent' },
}));

jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ on: jest.fn(), quit: jest.fn().mockResolvedValue('OK'), get: jest.fn(), set: jest.fn(), del: jest.fn() }))
}));

jest.mock('bullmq', () => ({ Queue: jest.fn().mockImplementation(() => ({ add: jest.fn(), close: jest.fn() })), Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn() })) }));
