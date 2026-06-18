import request from 'supertest';
import { env } from '../../src/config/env';

import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { describe, it, expect, jest } from '@jest/globals';
/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    customerAccount: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    customerProfile: { findUnique: jest.fn(), create: jest.fn() },
    gamingCenter: { findUnique: jest.fn(), findFirst: jest.fn() },
    gameStation: { findUnique: jest.fn() },
    reservation: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    phoneOtp: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    session: { create: jest.fn(), findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    siteSettings: { findUnique: jest.fn() },
    ['$transaction']: jest.fn((cb: any) => cb({
      reservation: { update: jest.fn(), create: jest.fn() },
      payment: { create: jest.fn(), update: jest.fn() },
      customerAccount: { create: jest.fn(), update: jest.fn() },
      customerProfile: { create: jest.fn() }
    })),
    ['$extends']: jest.fn().mockReturnThis(),
  },
}));

jest.mock('../../src/jobs/producers/sms.producer');
jest.mock('../../src/common/middleware/rateLimit', () => ({
  publicApiRateLimiter: (req: any, res: any, next: any) => next(),
  privateApiRateLimiter: (req: any, res: any, next: any) => next(),
  publicReservationRateLimiter: (req: any, res: any, next: any) => next(),
}));

describe('Priority User Journeys (E2E Logic)', () => {
  it('Journey 1: Registration OTP Flow', async () => {
    (prisma.customerAccount.findUnique as any).mockResolvedValue(null);
    const res = await request(app).post('/api/v1/auth/customer/otp/request').set('x-api-key', env.STATIC_API_KEY)
      .send({ phone: '09123456789' });
    expect(res.status).toBe(200);
  });
});
