/* eslint-disable @typescript-eslint/no-explicit-any */
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-long-enough';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-long-enough';
process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock';
process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.RATE_LIMIT_STORE = 'memory';
process.env.PORT = '3000';

import { prismaMock } from '../mocks/prisma.mock';
// import { bullmqMock } from '../mocks/bullmq.mock';
// import { ioredisMock } from '../mocks/ioredis.mock';

(globalThis as any).__prisma = prismaMock;

// import * as bullmq from 'bullmq';
// (bullmq as any).Queue = bullmqMock.Queue;
// (bullmq as any).Worker = bullmqMock.Worker;
// (bullmq as any).QueueEvents = bullmqMock.QueueEvents;

// import * as ioredis from 'ioredis';
// (ioredis as any).default = ioredisMock;

import { generateAccessToken } from '../../src/modules/auth/auth.tokens';
const token = generateAccessToken({ sessionId: 's-1', actorId: 'u-1', actorType: 'USER' });
console.log('E2E_MOCK_TOKEN=' + token);

import '../../src/server';
