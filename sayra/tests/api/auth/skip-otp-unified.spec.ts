import { describe, it, expect, jest, beforeEach } from '@jest/globals';
/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import argon2 from 'argon2';
import { env } from '../../../src/config/env';
import { OtpPurpose, SessionActorType } from '@prisma/client';
import httpStatus from 'http-status';
import { isSkipOtp, getEffectiveOtpCode, verifyOtpCode } from '../../../src/modules/auth/otp-security';

jest.mock('../../../src/jobs/producers/sms.producer', () => ({
  queueSms: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../src/config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockImplementation(() => Promise.resolve(null)),
    set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
    del: jest.fn().mockImplementation(() => Promise.resolve(1)),
    incr: jest.fn().mockImplementation(() => Promise.resolve(1)),
    expire: jest.fn().mockImplementation(() => Promise.resolve(1)),
    ttl: jest.fn().mockImplementation(() => Promise.resolve(120)),
    call: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  },
  redis: {
    get: jest.fn().mockImplementation(() => Promise.resolve(null)),
    set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
    del: jest.fn().mockImplementation(() => Promise.resolve(1)),
    incr: jest.fn().mockImplementation(() => Promise.resolve(1)),
    expire: jest.fn().mockImplementation(() => Promise.resolve(1)),
    ttl: jest.fn().mockImplementation(() => Promise.resolve(120)),
    call: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  },
}));

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    phoneOtp: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    gameCenterOnboarding: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('Comprehensive Unified SKIP_OTP Test Suite', () => {
  const testPhone = '09121234567';
  const normalizedPhone = '+989121234567';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Centralized OTP Security Helpers', () => {
    it('isSkipOtp() returns true only when SKIP_OTP=true and NODE_ENV != production', () => {
      const origSkip = env.SKIP_OTP;
      const origEnv = env.NODE_ENV;
      try {
        (env as any).SKIP_OTP = true;
        (env as any).NODE_ENV = 'development';
        expect(isSkipOtp()).toBe(true);

        (env as any).NODE_ENV = 'test';
        expect(isSkipOtp()).toBe(true);

        // Production safety: strictly false in production
        (env as any).NODE_ENV = 'production';
        expect(isSkipOtp()).toBe(false);

        (env as any).NODE_ENV = 'development';
        (env as any).SKIP_OTP = false;
        expect(isSkipOtp()).toBe(false);
      } finally {
        (env as any).SKIP_OTP = origSkip;
        (env as any).NODE_ENV = origEnv;
      }
    });

    it('getEffectiveOtpCode() returns 000000 when SKIP_OTP is active, random otherwise', () => {
      const origSkip = env.SKIP_OTP;
      try {
        (env as any).SKIP_OTP = true;
        expect(getEffectiveOtpCode(6)).toBe('000000');

        (env as any).SKIP_OTP = false;
        const code = getEffectiveOtpCode(6);
        expect(code).toHaveLength(6);
        expect(code).toMatch(/^\d{6}$/);
      } finally {
        (env as any).SKIP_OTP = origSkip;
      }
    });

    it('verifyOtpCode() accepts only 000000 when SKIP_OTP is active', async () => {
      const origSkip = env.SKIP_OTP;
      try {
        (env as any).SKIP_OTP = true;
        const dummyHash = await argon2.hash('123456');

        expect(await verifyOtpCode('000000', dummyHash)).toBe(true);
        expect(await verifyOtpCode('123456', dummyHash)).toBe(false);
        expect(await verifyOtpCode('999999', dummyHash)).toBe(false);
        expect(await verifyOtpCode('', dummyHash)).toBe(false);
      } finally {
        (env as any).SKIP_OTP = origSkip;
      }
    });

    it('verifyOtpCode() verifies against hash when SKIP_OTP is inactive', async () => {
      const origSkip = env.SKIP_OTP;
      try {
        (env as any).SKIP_OTP = false;
        const realCode = '654321';
        const codeHash = await argon2.hash(realCode);

        expect(await verifyOtpCode(realCode, codeHash)).toBe(true);
        expect(await verifyOtpCode('000000', codeHash)).toBe(false);
        expect(await verifyOtpCode('111111', codeHash)).toBe(false);
      } finally {
        (env as any).SKIP_OTP = origSkip;
      }
    });
  });

  describe('1. Unified OTP Authentication Flow (/api/v1/auth/otp/...)', () => {
    it('With SKIP_OTP=true: requests static 000000 and logs in successfully', async () => {
      const origSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true;

      try {
        const { queueSms } = await import('../../../src/jobs/producers/sms.producer');
        (queueSms as any).mockClear();

        (prisma.phoneOtp.updateMany as any).mockResolvedValue({ count: 1 });
        (prisma.phoneOtp.create as any).mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'otp-u-skip', ...data })
        );

        // Request OTP
        const reqRes = await request(app)
          .post('/api/v1/auth/otp/request')
          .send({ phone: testPhone });

        expect(reqRes.status).toBe(httpStatus.OK);
        expect(reqRes.body.success).toBe(true);
        expect(queueSms).not.toHaveBeenCalled();

        // Verify stored codeHash is keyed HMAC-SHA256 for 000000
        const createCall = (prisma.phoneOtp.create as any).mock.calls[0][0];
        expect(createCall.data.codeHash).toMatch(/^hmac256:[0-9a-f]{32}:[0-9a-f]{64}$/);
        const { verifyOtpCode } = await import('../../../src/modules/auth/otp-security');
        (env as any).SKIP_OTP = false;
        expect(
          await verifyOtpCode('000000', createCall.data.codeHash, {
            phone: normalizedPhone,
            purpose: OtpPurpose.LOGIN,
          })
        ).toBe(true);
        (env as any).SKIP_OTP = true;

        // Login with 000000
        const mockCustomer = {
          id: 'cust-u1',
          phone: normalizedPhone,
          phoneVerifiedAt: new Date(),
        };
        (prisma.phoneOtp.findFirst as any).mockResolvedValue({
          id: 'otp-u-skip',
          phone: normalizedPhone,
          purpose: OtpPurpose.LOGIN,
          codeHash: createCall.data.codeHash,
          attempts: 0,
          expiresAt: new Date(Date.now() + 60000),
          consumedAt: null,
        });
        (prisma.user.findMany as any).mockResolvedValue([]);
        (prisma.customerAccount.findUnique as any).mockResolvedValue(mockCustomer);
        (prisma.customerAccount.findFirst as any).mockResolvedValue(mockCustomer);
        (prisma.session.create as any).mockResolvedValue({ id: 'sess-u1' });

        const loginRes = await request(app)
          .post('/api/v1/auth/otp/login')
          .send({ phone: testPhone, otp: '000000' });

        expect(loginRes.status).toBe(httpStatus.OK);
        expect(loginRes.body.success).toBe(true);
        expect(loginRes.body.data.user.id).toBe(mockCustomer.id);
      } finally {
        (env as any).SKIP_OTP = origSkip;
      }
    });

    it('With SKIP_OTP=true: rejects code other than 000000', async () => {
      const origSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true;

      try {
        (prisma.phoneOtp.findFirst as any).mockResolvedValue({
          id: 'otp-u-skip',
          phone: normalizedPhone,
          purpose: OtpPurpose.LOGIN,
          codeHash: await argon2.hash('000000'),
          attempts: 0,
          expiresAt: new Date(Date.now() + 60000),
          consumedAt: null,
        });
        (prisma.phoneOtp.update as any).mockResolvedValue({ id: 'otp-u-skip', attempts: 1 });

        const loginRes = await request(app)
          .post('/api/v1/auth/otp/login')
          .send({ phone: testPhone, otp: '123456' });

        expect(loginRes.status).toBe(httpStatus.UNAUTHORIZED);
        expect(loginRes.body.error.message).toBe('Invalid or expired OTP.');
      } finally {
        (env as any).SKIP_OTP = origSkip;
      }
    });

    it('With SKIP_OTP=false: rejects 000000 when code is different', async () => {
      const codeHash = await argon2.hash('555555');
      (prisma.phoneOtp.findFirst as any).mockResolvedValue({
        id: 'otp-normal',
        phone: normalizedPhone,
        purpose: OtpPurpose.LOGIN,
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 60000),
        consumedAt: null,
      });
      (prisma.phoneOtp.update as any).mockResolvedValue({ id: 'otp-normal', attempts: 1 });

      const loginRes = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({ phone: testPhone, otp: '000000' });

      expect(loginRes.status).toBe(httpStatus.UNAUTHORIZED);
      expect(loginRes.body.error.message).toBe('Invalid or expired OTP.');
    });
  });

  describe('2. User Authentication OTP Flow (/api/v1/auth/user/...)', () => {
    it('With SKIP_OTP=true: request and verify succeed with 000000', async () => {
      const origSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true;

      try {
        (prisma.phoneOtp.create as any).mockResolvedValue({ id: 'otp-user-1' });
        (prisma.phoneOtp.findFirst as any).mockResolvedValue({
          id: 'otp-user-1',
          phone: normalizedPhone,
          purpose: OtpPurpose.LOGIN,
          codeHash: await argon2.hash('000000'),
          targetActorType: SessionActorType.USER,
          expiresAt: new Date(Date.now() + 60000),
          consumedAt: null,
        });
        (prisma.phoneOtp.update as any).mockResolvedValue({ id: 'otp-user-1', consumedAt: new Date() });
        (prisma.user.updateMany as any).mockResolvedValue({ count: 1 });
        (prisma.user.findMany as any).mockResolvedValue([
          { gamingCenter: { id: 'center-1', name: 'Nexus Arena' } },
        ]);

        const reqRes = await request(app)
          .post('/api/v1/auth/user/otp/request')
          .send({ phone: testPhone });
        expect(reqRes.status).toBe(httpStatus.OK);

        const verifyRes = await request(app)
          .post('/api/v1/auth/user/otp/verify')
          .send({ phone: testPhone, code: '000000' });
        expect(verifyRes.status).toBe(httpStatus.OK);
        expect(verifyRes.body.data.gamingCenters).toHaveLength(1);
      } finally {
        (env as any).SKIP_OTP = origSkip;
      }
    });

    it('With SKIP_OTP=true: rejects code other than 000000', async () => {
      const origSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true;

      try {
        const verifyRes = await request(app)
          .post('/api/v1/auth/user/otp/verify')
          .send({ phone: testPhone, code: '111111' });
        expect(verifyRes.status).toBe(httpStatus.UNAUTHORIZED);
      } finally {
        (env as any).SKIP_OTP = origSkip;
      }
    });
  });

  describe('3. Customer Authentication OTP Flow (/api/v1/auth/customer/...)', () => {
    it('With SKIP_OTP=true: request and verify succeed with 000000', async () => {
      const origSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true;

      try {
        const mockCustomer = {
          id: 'cust-c1',
          phone: normalizedPhone,
          phoneVerifiedAt: new Date(),
        };
        (prisma.phoneOtp.create as any).mockResolvedValue({ id: 'otp-cust-1' });
        (prisma.phoneOtp.findFirst as any).mockResolvedValue({
          id: 'otp-cust-1',
          phone: normalizedPhone,
          purpose: OtpPurpose.LOGIN,
          codeHash: await argon2.hash('000000'),
          targetActorType: SessionActorType.CUSTOMER,
          expiresAt: new Date(Date.now() + 60000),
          consumedAt: null,
        });
        (prisma.phoneOtp.update as any).mockResolvedValue({ id: 'otp-cust-1', consumedAt: new Date() });
        (prisma.user.findMany as any).mockResolvedValue([]);
        (prisma.customerAccount.findUnique as any).mockResolvedValue(mockCustomer);
        (prisma.customerAccount.findFirst as any).mockResolvedValue(mockCustomer);
        (prisma.session.create as any).mockResolvedValue({ id: 'sess-c1' });

        const reqRes = await request(app)
          .post('/api/v1/auth/customer/otp/request')
          .send({ phone: testPhone });
        expect(reqRes.status).toBe(httpStatus.OK);

        const verifyRes = await request(app)
          .post('/api/v1/auth/customer/otp/verify')
          .send({ phone: testPhone, code: '000000' });
        expect(verifyRes.status).toBe(httpStatus.OK);
        expect(verifyRes.body.data.customer.id).toBe(mockCustomer.id);
      } finally {
        (env as any).SKIP_OTP = origSkip;
      }
    });

    it('With SKIP_OTP=true: rejects code other than 000000', async () => {
      const origSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true;

      try {
        const verifyRes = await request(app)
          .post('/api/v1/auth/customer/otp/verify')
          .send({ phone: testPhone, code: '888888' });
        expect(verifyRes.status).toBe(httpStatus.UNAUTHORIZED);
      } finally {
        (env as any).SKIP_OTP = origSkip;
      }
    });
  });

  describe('4. Manager Onboarding OTP Flow (/api/v1/onboarding/...)', () => {
    it('With SKIP_OTP=true: start and verify succeed with 000000', async () => {
      const origSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true;

      try {
        const mockDraft = {
          id: 'onb-skip-1',
          gameCenterName: 'VR World',
          managerFullName: 'Reza Rezaei',
          managerPhone: normalizedPhone,
          step: 'OTP_PENDING',
        };

        (prisma.gameCenterOnboarding.findFirst as any).mockResolvedValue(null);
        (prisma.gameCenterOnboarding.create as any).mockResolvedValue(mockDraft);
        (prisma.phoneOtp.create as any).mockResolvedValue({ id: 'otp-onb-1' });

        const startRes = await request(app)
          .post('/api/v1/onboarding/start')
          .send({
            gameCenterName: 'VR World',
            managerFullName: 'Reza Rezaei',
            managerPhone: testPhone,
          });

        expect(startRes.status).toBe(httpStatus.CREATED);
        expect(startRes.body.data.onboardingId).toBe(mockDraft.id);

        (prisma.gameCenterOnboarding.findUnique as any).mockResolvedValue(mockDraft);
        (prisma.phoneOtp.findFirst as any).mockResolvedValue({
          id: 'otp-onb-1',
          phone: normalizedPhone,
          purpose: OtpPurpose.SIGNUP,
          codeHash: await argon2.hash('000000'),
          expiresAt: new Date(Date.now() + 60000),
          consumedAt: null,
        });
        (prisma.phoneOtp.update as any).mockResolvedValue({ id: 'otp-onb-1', consumedAt: new Date() });
        (prisma.user.findMany as any).mockResolvedValue([]);
        (prisma.gameCenterOnboarding.update as any).mockResolvedValue({
          ...mockDraft,
          step: 'LOCATION_PENDING',
        });

        const verifyRes = await request(app)
          .post('/api/v1/onboarding/otp/verify')
          .send({
            onboardingId: mockDraft.id,
            code: '000000',
          });

        expect(verifyRes.status).toBe(httpStatus.OK);
        expect(verifyRes.body.data.verified).toBe(true);
      } finally {
        (env as any).SKIP_OTP = origSkip;
      }
    });

    it('With SKIP_OTP=true: rejects code other than 000000', async () => {
      const origSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true;

      try {
        (prisma.gameCenterOnboarding.findUnique as any).mockResolvedValue({
          id: 'onb-skip-2',
          managerPhone: normalizedPhone,
        });

        const verifyRes = await request(app)
          .post('/api/v1/onboarding/otp/verify')
          .send({
            onboardingId: 'onb-skip-2',
            code: '777777',
          });

        expect(verifyRes.status).toBe(httpStatus.UNAUTHORIZED);
      } finally {
        (env as any).SKIP_OTP = origSkip;
      }
    });
  });

  describe('5. Public Booking Phone Verification with SKIP_OTP', () => {
    it('Requires OTP verification when requireOtpForPublicBooking is true; succeeds after verifying 000000', async () => {
      const origSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true;

      try {
        const { AuthRepository } = await import('../../../src/modules/auth/auth.repository');
        const verificationWindow = new Date(Date.now() - 15 * 60 * 1000);

        // Before OTP verification: findRecentConsumedOtp returns null
        (prisma.phoneOtp.findFirst as any).mockResolvedValue(null);
        const unverified = await AuthRepository.findRecentConsumedOtp(normalizedPhone, OtpPurpose.LOGIN, verificationWindow);
        expect(unverified).toBeNull();

        // Customer verifies OTP with 000000 -> consumedAt is set
        const consumedOtp = {
          id: 'otp-booking-consumed',
          phone: normalizedPhone,
          purpose: OtpPurpose.LOGIN,
          consumedAt: new Date(),
        };
        (prisma.phoneOtp.findFirst as any).mockResolvedValue(consumedOtp);

        const verified = await AuthRepository.findRecentConsumedOtp(normalizedPhone, OtpPurpose.LOGIN, verificationWindow);
        expect(verified).not.toBeNull();
        expect(verified?.consumedAt).toBeDefined();
      } finally {
        (env as any).SKIP_OTP = origSkip;
      }
    });
  });
});
