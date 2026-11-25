import { OtpPurpose, PhoneOtp, SessionActorType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { queueSms } from '../../jobs/producers/sms.producer';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import {
  enforceRateLimit,
  progressiveDelay,
  isSkipOtp,
  getEffectiveOtpCode,
  hashOtpCode,
  verifyOtpCode,
} from './otp-security';
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
    metadata?: { ip?: string; userAgent?: string },
    targetActorType?: SessionActorType
  ) {
    const ip = metadata?.ip || 'unknown';

    const phoneRateLimit = Number(env.OTP_REQUEST_RATE_LIMIT_PHONE) || 3;
    const ipRateLimit = Number(env.OTP_REQUEST_RATE_LIMIT_IP) || 10;
    const otpTtlMinutes = Number(env.OTP_EXPIRATION_MINUTES) || 2;

    // Rate limiting per phone and per IP
    await enforceRateLimit(
      `rl:otp:req:phone:${normalizedPhone}`,
      phoneRateLimit,
      120,
      'Too many OTP requests for this phone number. Please wait.'
    );
    await enforceRateLimit(
      `rl:otp:req:ip:${ip}`,
      ipRateLimit,
      120,
      'Too many OTP requests from this IP address. Please wait.'
    );

    // Delete superseded unconsumed OTPs instead of marking consumedAt (prevents consumedAt confusion)
    await prisma.phoneOtp.deleteMany({
      where: {
        phone: normalizedPhone,
        purpose,
        consumedAt: null,
        ...(targetActorType !== undefined ? { targetActorType } : {}),
      },
    });

    const code = getEffectiveOtpCode(6);
    const codeHash = hashOtpCode(code, { phone: normalizedPhone, purpose });
    const expiresAt = new Date(Date.now() + otpTtlMinutes * 60 * 1000);

    const otp = await prisma.phoneOtp.create({
      data: {
        phone: normalizedPhone,
        purpose,
        codeHash,
        expiresAt,
        ip: metadata?.ip,
        userAgent: metadata?.userAgent,
        attempts: 0,
        ...(targetActorType !== undefined ? { targetActorType } : {}),
      },
    });

    if (!isSkipOtp()) {
      await queueSms({
        mobile: normalizedPhone,
        templateId: getOtpTemplateId(),
        parameters: [{ name: 'CODE', value: code }],
      });
    }

    logger.info({ phone: normalizedPhone, otpId: otp.id }, 'OTP requested successfully');
    return {
      message: `OTP sent to ${normalizedPhone}. It will expire in ${otpTtlMinutes} minutes.`,
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
    metadata?: { ip?: string },
    targetActorType?: SessionActorType
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
        ...(targetActorType !== undefined ? { targetActorType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new AppError('Invalid or expired OTP.', httpStatus.UNAUTHORIZED);
    }

    const maxAttempts = Number(env.OTP_MAX_ATTEMPTS) || 5;

    if (otp.attempts >= maxAttempts) {
      // Delete exhausted OTPs instead of setting consumedAt
      try {
        await prisma.phoneOtp.delete({
          where: { id: otp.id },
        });
      } catch (e) {
        // ignore delete errors
      }
      throw new AppError('Too many failed attempts. OTP has been invalidated.', httpStatus.UNAUTHORIZED);
    }

    // Check code validity via unified OTP verification
    const isValid = await verifyOtpCode(code, otp.codeHash, { phone: normalizedPhone, purpose });

    if (!isValid) {
      const newAttempts = otp.attempts + 1;
      const isLocked = newAttempts >= maxAttempts;

      if (isLocked) {
        await prisma.phoneOtp.delete({
          where: { id: otp.id },
        });
      } else {
        await prisma.phoneOtp.update({
          where: { id: otp.id },
          data: {
            attempts: { increment: 1 },
          },
        });
      }

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
