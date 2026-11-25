/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import argon2 from 'argon2';
import httpStatus from 'http-status';
import { OtpPurpose, SessionActorType, UserRole } from '@prisma/client';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { OtpService } from '../../src/modules/auth/otp.service';
import { authService } from '../../src/modules/auth/auth.station';
import { AuthRepository } from '../../src/modules/auth/auth.repository';

jest.mock('../../src/jobs/producers/sms.producer', () => ({
  queueSms: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../src/config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockImplementation(() => Promise.resolve(null)),
    set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
    del: jest.fn().mockImplementation(() => Promise.resolve(1)),
    incr: jest.fn().mockImplementation(() => Promise.resolve(1)),
    expire: jest.fn().mockImplementation(() => Promise.resolve(1)),
    ttl: jest.fn().mockImplementation(() => Promise.resolve(120)),
  },
}));

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    phoneOtp: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    session: {
      create: jest.fn(),
    },
  },
}));

describe('SEC-002: Deprecated OTP Login Takeover & consumedAt Confusion', () => {
  const targetPhone = '+989123456789';
  const gamingCenterId = 'gc_target_1';
  let otpStore: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    otpStore = [];

    (prisma.phoneOtp.deleteMany as any).mockImplementation((args: any) => {
      const where = args?.where || {};
      const before = otpStore.length;
      otpStore = otpStore.filter((row) => {
        if (where.id && row.id !== where.id) return true;
        if (where.phone && row.phone !== where.phone) return true;
        if (where.purpose && row.purpose !== where.purpose) return true;
        if (where.consumedAt === null && row.consumedAt !== null) return true;
        if (where.consumedAt?.not === null && row.consumedAt === null) return true;
        if (where.targetActorType !== undefined && row.targetActorType !== where.targetActorType) return true;
        return false;
      });
      return Promise.resolve({ count: before - otpStore.length });
    });

    (prisma.phoneOtp.delete as any).mockImplementation((args: any) => {
      const id = args?.where?.id;
      const existing = otpStore.find((row) => row.id === id) || null;
      otpStore = otpStore.filter((row) => row.id !== id);
      return Promise.resolve(existing);
    });

    (prisma.phoneOtp.create as any).mockImplementation((args: any) => {
      const row = {
        id: `otp_${otpStore.length + 1}`,
        createdAt: new Date(Date.now() + otpStore.length),
        consumedAt: null,
        attempts: 0,
        targetActorType: null,
        ...args.data,
      };
      otpStore.push(row);
      return Promise.resolve(row);
    });

    (prisma.phoneOtp.findFirst as any).mockImplementation((args: any) => {
      const where = args?.where || {};
      const matches = otpStore.filter((row) => {
        if (where.phone && row.phone !== where.phone) return false;
        if (where.purpose && row.purpose !== where.purpose) return false;
        if (where.consumedAt === null && row.consumedAt !== null) return false;
        if (where.consumedAt?.gte && (!row.consumedAt || row.consumedAt < where.consumedAt.gte)) return false;
        if (where.expiresAt?.gt && !(row.expiresAt > where.expiresAt.gt)) return false;
        if (where.attempts?.lt !== undefined && !(row.attempts < where.attempts.lt)) return false;
        if (where.targetActorType !== undefined && row.targetActorType !== where.targetActorType) return false;
        return true;
      });
      matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return Promise.resolve(matches[0] || null);
    });

    (prisma.phoneOtp.update as any).mockImplementation((args: any) => {
      const row = otpStore.find((item) => item.id === args?.where?.id);
      if (!row) return Promise.resolve(null);
      if (args.data?.attempts?.increment) {
        row.attempts += args.data.attempts.increment;
      }
      if (args.data?.consumedAt !== undefined) {
        row.consumedAt = args.data.consumedAt;
      }
      return Promise.resolve(row);
    });

    (prisma.phoneOtp.updateMany as any).mockImplementation((args: any) => {
      let count = 0;
      for (const row of otpStore) {
        if (args.where?.id && row.id !== args.where.id) continue;
        if (args.where?.consumedAt === null && row.consumedAt !== null) continue;
        if (args.data?.consumedAt !== undefined) {
          row.consumedAt = args.data.consumedAt;
        }
        count += 1;
      }
      return Promise.resolve({ count });
    });
  });

  it('blocks requesting a second OTP from turning superseded OTP into a verified login for /user/login/otp', async () => {
    (prisma.user.findFirst as any).mockResolvedValue({
      id: 'mgr_1',
      phone: targetPhone,
      gamingCenterId,
      role: UserRole.MANAGER,
      isActive: true,
      passwordHash: '$argon2id$secret_hash',
    });

    await request(app).post('/api/v1/auth/user/otp/request').send({ phone: '09123456789' }).expect(httpStatus.OK);
    await request(app).post('/api/v1/auth/otp/request').send({ phone: '09123456789' }).expect(httpStatus.OK);

    const attackRes = await request(app)
      .post('/api/v1/auth/user/login/otp')
      .send({ phone: '09123456789', gamingCenterId });

    expect(attackRes.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('deletes OTP on max failed attempts so exhausted OTPs cannot satisfy /user/login/otp', async () => {
    const codeHash = await argon2.hash('654321');
    otpStore.push({
      id: 'otp_brute',
      phone: targetPhone,
      purpose: OtpPurpose.LOGIN,
      codeHash,
      expiresAt: new Date(Date.now() + 120_000),
      consumedAt: null,
      attempts: 4,
      targetActorType: SessionActorType.USER,
      createdAt: new Date(),
    });

    await expect(
      OtpService.verifyAndConsumeOtp(targetPhone, '000001', OtpPurpose.LOGIN, { ip: '127.0.0.1' }, SessionActorType.USER)
    ).rejects.toThrow('Too many failed attempts. OTP has been invalidated.');

    expect(otpStore).toHaveLength(0);

    const loginRes = await request(app)
      .post('/api/v1/auth/user/login/otp')
      .send({ phone: '09123456789', gamingCenterId });
    expect(loginRes.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('prevents replay of /user/login/otp after one successful login and strips passwordHash', async () => {
    otpStore.push({
      id: 'otp_valid_user',
      phone: targetPhone,
      purpose: OtpPurpose.LOGIN,
      codeHash: 'verified_hash',
      expiresAt: new Date(Date.now() + 120_000),
      consumedAt: new Date(),
      attempts: 0,
      targetActorType: SessionActorType.USER,
      createdAt: new Date(),
    });

    (prisma.user.findFirst as any).mockResolvedValue({
      id: 'mgr_1',
      phone: targetPhone,
      gamingCenterId,
      role: UserRole.MANAGER,
      isActive: true,
      passwordHash: '$argon2id$must_never_leak',
    });
    (prisma.session.create as any).mockResolvedValue({ id: 'sess_1' });

    const firstRes = await request(app)
      .post('/api/v1/auth/user/login/otp')
      .send({ phone: '09123456789', gamingCenterId });

    expect(firstRes.status).toBe(httpStatus.OK);
    expect(firstRes.body.data.tokens).toBeDefined();
    expect(firstRes.body.data.user.passwordHash).toBeUndefined();

    // Replay attempt must fail because consumed OTP is deleted atomically
    const replayRes = await request(app)
      .post('/api/v1/auth/user/login/otp')
      .send({ phone: '09123456789', gamingCenterId });

    expect(replayRes.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('rejects inactive User accounts in loginUserWithOtp and strips passwordHash in loginUser', async () => {
    const hash = await argon2.hash('StrongPass!123');
    otpStore.push({
      id: 'otp_inactive',
      phone: targetPhone,
      purpose: OtpPurpose.LOGIN,
      codeHash: 'verified_hash',
      expiresAt: new Date(Date.now() + 120_000),
      consumedAt: new Date(),
      attempts: 0,
      targetActorType: SessionActorType.USER,
      createdAt: new Date(),
    });

    (prisma.user.findFirst as any).mockResolvedValue({
      id: 'mgr_disabled',
      phone: targetPhone,
      gamingCenterId,
      role: UserRole.MANAGER,
      isActive: false,
      passwordHash: hash,
    });

    await expect(authService.loginUserWithOtp(targetPhone, gamingCenterId)).rejects.toThrow(
      'Invalid credentials for the selected gamingCenter.'
    );

    jest.spyOn(AuthRepository, 'findUserByPhone').mockResolvedValueOnce({
      id: 'mgr_active',
      phone: targetPhone,
      gamingCenterId,
      role: UserRole.MANAGER,
      isActive: true,
      passwordHash: hash,
    } as any);
    (prisma.session.create as any).mockResolvedValue({ id: 'sess_pw' });

    const pwLogin = await authService.loginUser(targetPhone, 'StrongPass!123', gamingCenterId);
    expect((pwLogin.user as any).passwordHash).toBeUndefined();
  });
});
