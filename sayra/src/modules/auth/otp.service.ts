import argon2 from 'argon2';
import { OtpPurpose, PhoneOtp } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { queueSms } from '../../jobs/producers/sms.producer';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { generateSecureNumericOtp, enforceRateLimit, progressiveDelay } from './otp-security';
import logger from '../../config/logger';

const getOtpTemplateId = (): number => {
  const templateId = env.MELIPAYAMAK_OTP_BODY_ID || env.SMSIR_OTP_TEMPLATE_ID;
  if (!templateId) {
    throw new Error('MELIPAYAMAK_OTP_BODY_ID or SMSIR_OTP_TEMPLATE_ID must be set in environment variables.');
  }
  return templateId;
};

export const OtpService = {
  /**
   * Request a new OTP for login/auth.
   * Invalidates any active OTP for this phone and purpose.
   */
  async requestOtp(
    normalizedPhone: string,
    purpose: OtpPurpose = OtpPurpose.LOGIN,
    metadata?: { ip?: string; userAgent?: string }
  ) {
    const ip = metadata?.ip || 'unknown';

    // Rate limiting per phone and per IP
    await enforceRateLimit(
      `rl:otp:req:phone:${normalizedPhone}`,
      env.OTP_REQUEST_RATE_LIMIT_PHONE,
      120,
      'Too many OTP requests for this phone number. Please wait.'
    );
    await enforceRateLimit(
      `rl:otp:req:ip:${ip}`,
      env.OTP_REQUEST_RATE_LIMIT_IP,
      120,
      'Too many OTP requests from this IP address. Please wait.'
    );

    // Invalidate previous unconsumed active OTPs for this phone and purpose
    await prisma.phoneOtp.updateMany({
      where: {
        phone: normalizedPhone,
        purpose,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    const isSkipOtp = Boolean(env.SKIP_OTP);
    const code = isSkipOtp ? '000000' : generateSecureNumericOtp(6);
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRATION_MINUTES * 60 * 1000);

    const otp = await prisma.phoneOtp.create({
      data: {
        phone: normalizedPhone,
        purpose,
        codeHash,
        expiresAt,
        ip: metadata?.ip,
        userAgent: metadata?.userAgent,
        attempts: 0,
      },
    });

    if (!isSkipOtp) {
      await queueSms({
        mobile: normalizedPhone,
        templateId: getOtpTemplateId(),
        parameters: [{ name: 'CODE', value: code }],
      });
    }

    logger.info({ phone: normalizedPhone, otpId: otp.id }, 'OTP requested successfully');
    return {
      message: `OTP sent to ${normalizedPhone}. It will expire in ${env.OTP_EXPIRATION_MINUTES} minutes.`,
    };
  },

  /**
   * Verify and atomically consume an OTP.
   * Handles brute-force protection (max 5 attempts), replay prevention,
   * race condition prevention via atomic SQL/conditional update.
   */
  async verifyAndConsumeOtp(
    normalizedPhone: string,
    code: string,
    purpose: OtpPurpose = OtpPurpose.LOGIN,
    metadata?: { ip?: string }
  ): Promise<PhoneOtp> {
    const ip = metadata?.ip || 'unknown';

    // Rate limiting for verify attempts
    await enforceRateLimit(
      `rl:otp:verify:phone:${normalizedPhone}`,
      10,
      120,
      'Too many verification attempts. Please wait.'
    );
    await enforceRateLimit(
      `rl:otp:verify:ip:${ip}`,
      30,
      120,
      'Too many verification attempts from this IP. Please wait.'
    );

    // Find the latest active unconsumed OTP
    const otp = await prisma.phoneOtp.findFirst({
      where: {
        phone: normalizedPhone,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new AppError('Invalid or expired OTP.', httpStatus.UNAUTHORIZED);
    }

    const maxAttempts = Number(env.OTP_MAX_ATTEMPTS) || 5;

    if (otp.attempts >= maxAttempts) {
      // Invalidate the OTP to prevent further brute force
      try {
        await prisma.phoneOtp.update({
          where: { id: otp.id },
          data: { consumedAt: new Date() },
        });
      } catch (e) {
        // ignore update errors
      }
      throw new AppError('Too many failed attempts. OTP has been invalidated.', httpStatus.UNAUTHORIZED);
    }

    const isSkipOtp = Boolean(env.SKIP_OTP);

    // Check code validity
    let isValid = false;
    if (isSkipOtp && code === '000000') {
      isValid = true;
    } else if (isSkipOtp && code !== '000000') {
      isValid = false;
    } else {
      isValid = await argon2.verify(otp.codeHash, code);
    }

    if (!isValid) {
      const newAttempts = otp.attempts + 1;
      const isLocked = newAttempts >= env.OTP_MAX_ATTEMPTS;

      await prisma.phoneOtp.update({
        where: { id: otp.id },
        data: {
          attempts: { increment: 1 },
          ...(isLocked ? { consumedAt: new Date() } : {}),
        },
      });

      await progressiveDelay(newAttempts);

      if (isLocked) {
        throw new AppError('Too many failed attempts. OTP has been invalidated.', httpStatus.UNAUTHORIZED);
      }

      throw new AppError('Invalid or expired OTP.', httpStatus.UNAUTHORIZED);
    }

    // Atomic consumption: Use updateMany with consumedAt: null condition to guarantee single-winner
    const consumptionResult = await prisma.phoneOtp.updateMany({
      where: {
        id: otp.id,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    if (consumptionResult.count === 0) {
      // Another concurrent process consumed it first (Race condition prevented!)
      throw new AppError('OTP has already been used.', httpStatus.UNAUTHORIZED);
    }

    return { ...otp, consumedAt: new Date() };
  },
};
