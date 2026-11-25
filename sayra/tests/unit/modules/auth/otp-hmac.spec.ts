/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import argon2 from 'argon2';
import { OtpPurpose } from '@prisma/client';
import { prisma } from '../../../../src/config/prisma';
import {
  hashOtpCode,
  verifyOtpCode,
  OTP_HMAC_PREFIX,
} from '../../../../src/modules/auth/otp-security';
import { OtpService } from '../../../../src/modules/auth/otp.service';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    phoneOtp: {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../../../../src/jobs/producers/sms.producer', () => ({
  queueSms: jest.fn().mockResolvedValue(undefined as never),
}));

describe('OTP Keyed HMAC-SHA256 Hashing (AMI-39)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should produce unique salted hmac256 hashes and verify via constant-time comparison', async () => {
    const hash1 = hashOtpCode('482910', { phone: '+989121112233', purpose: OtpPurpose.LOGIN });
    const hash2 = hashOtpCode('482910', { phone: '+989121112233', purpose: OtpPurpose.LOGIN });

    expect(hash1.startsWith(OTP_HMAC_PREFIX)).toBe(true);
    expect(hash1).not.toBe(hash2);

    expect(await verifyOtpCode('482910', hash1, { phone: '+989121112233', purpose: OtpPurpose.LOGIN })).toBe(true);
    expect(await verifyOtpCode('000000', hash1, { phone: '+989121112233', purpose: OtpPurpose.LOGIN })).toBe(false);
    expect(await verifyOtpCode('482910', hash1, { phone: '+989129999999', purpose: OtpPurpose.LOGIN })).toBe(false);
    expect(await verifyOtpCode('482910', hash1, { phone: '+989121112233', purpose: OtpPurpose.SIGNUP })).toBe(false);
  });

  it('should backward-compatibly verify real in-flight $argon2 OTP hashes during rollover', async () => {
    const legacyHash = await argon2.hash('654321');
    expect(legacyHash.startsWith('$argon2')).toBe(true);

    expect(await verifyOtpCode('654321', legacyHash, { phone: '+989121112233', purpose: OtpPurpose.LOGIN })).toBe(true);
    expect(await verifyOtpCode('111111', legacyHash, { phone: '+989121112233', purpose: OtpPurpose.LOGIN })).toBe(false);
  });

  it('should never invoke argon2.hash during OtpService.requestOtp', async () => {
    const argonHashSpy = jest.spyOn(argon2, 'hash');
    ((prisma as any).phoneOtp.deleteMany as jest.MockedFunction<any>).mockResolvedValue({ count: 0 });
    ((prisma as any).phoneOtp.create as jest.MockedFunction<any>).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'otp-1', ...data })
    );

    process.env.SMSIR_OTP_TEMPLATE_ID = '1001';
    await OtpService.requestOtp('+989121112233', OtpPurpose.LOGIN);

    expect(argonHashSpy).not.toHaveBeenCalled();
    const saved = ((prisma as any).phoneOtp.create as jest.MockedFunction<any>).mock.calls[0][0].data;
    expect(saved.codeHash).toMatch(/^hmac256:[0-9a-f]{32}:[0-9a-f]{64}$/);
    argonHashSpy.mockRestore();
  });
});
