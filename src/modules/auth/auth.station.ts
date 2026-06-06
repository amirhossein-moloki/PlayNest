import argon2 from 'argon2';
import crypto from 'crypto';
import { AuthRepository } from './auth.repository';
import { generateAccessToken } from './auth.tokens';
import { OtpPurpose, SessionActorType } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { env } from '../../config/env';
import { queueSms } from '../../jobs/producers/sms.producer';

const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// OTP settings
const OTP_EXPIRATION_MINUTES = 2;
const OTP_LENGTH = 6;
const OTP_POST_VERIFICATION_WINDOW_MINUTES = 5; // How long a user has to login after verifying OTP

const generateNumericOtp = (length: number): string => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

const getOtpTemplateId = (): number => {
  const templateId = env.SMSIR_OTP_TEMPLATE_ID;
  if (!templateId) {
    throw new Error('SMSIR_OTP_TEMPLATE_ID must be set in the environment variables.');
  }
  return templateId;
};

const createAndSaveSession = async (actorId: string, actorType: SessionActorType) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // 1. Generate a secure, random refresh token.
  const refreshToken = crypto.randomBytes(32).toString('hex');

  // 2. Hash the refresh token for database storage.
  const tokenHash = hashToken(refreshToken);

  // 3. Create the session with the hashed token.
  const session = await AuthRepository.createSession(actorId, actorType, tokenHash, expiresAt);

  // 4. Create the access token.
  const payload = { sessionId: session.id, actorId, actorType };
  const accessToken = generateAccessToken(payload);

  // 5. Return the raw refresh token to the client. It's sent only once.
  return { accessToken, refreshToken };
};

export const authService = {
  async loginUser(phone: string, password: string, gamingCenterId: string) {
    const user = await AuthRepository.findUserByPhone(phone, gamingCenterId);
    if (!user || !user.passwordHash) {
      throw new AppError('Invalid credentials', httpStatus.UNAUTHORIZED);
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', httpStatus.UNAUTHORIZED);
    }

    const { accessToken, refreshToken } = await createAndSaveSession(user.id, 'USER');

    return {
      user,
      tokens: { accessToken, refreshToken },
    };
  },

  async requestUserOtp(phone: string) {
    const users = await AuthRepository.findUsersWithGamingCenters(phone);
    if (users.length === 0) {
      throw new AppError('No user found with this phone number.', httpStatus.NOT_FOUND);
    }

    const code = generateNumericOtp(OTP_LENGTH);
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    await AuthRepository.createOtp({
      phone,
      purpose: OtpPurpose.LOGIN,
      codeHash,
      expiresAt,
    });

    await queueSms({ mobile: phone, templateId: getOtpTemplateId(), parameters: [{ name: 'CODE', value: code }] });

    return { message: `OTP sent to ${phone}. It will expire in ${OTP_EXPIRATION_MINUTES} minutes.` };
  },

  async verifyUserOtp(phone: string, code: string) {
    const otp = await AuthRepository.findRecentOtp(phone, OtpPurpose.LOGIN);

    if (!otp) {
      throw new AppError('Invalid or expired OTP.', httpStatus.UNAUTHORIZED);
    }

    const isCodeValid = await argon2.verify(otp.codeHash, code);

    if (!isCodeValid) {
      // Optional: Increment an attempt counter to prevent brute-force attacks
      throw new AppError('Invalid or expired OTP.', httpStatus.UNAUTHORIZED);
    }

    await AuthRepository.consumeOtp(otp.id);
    await AuthRepository.markUserPhoneVerified(phone);

    const users = await AuthRepository.findUsersWithGamingCenters(phone);

    const gamingCenters = users.map(user => ({
      id: user.gamingCenter.id,
      name: user.gamingCenter.name,
    }));

    return { gamingCenters };
  },

  async requestCustomerOtp(phone: string) {
    const code = generateNumericOtp(OTP_LENGTH);
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    await AuthRepository.createOtp({
      phone,
      purpose: OtpPurpose.LOGIN,
      codeHash,
      expiresAt,
    });

    await queueSms({ mobile: phone, templateId: getOtpTemplateId(), parameters: [{ name: 'CODE', value: code }] });

    return { message: `OTP sent to ${phone}. It will expire in ${OTP_EXPIRATION_MINUTES} minutes.` };
  },

  async verifyCustomerOtp(phone: string, code: string) {
    const otp = await AuthRepository.findRecentOtp(phone, OtpPurpose.LOGIN);

    if (!otp) {
      throw new AppError('Invalid or expired OTP.', httpStatus.UNAUTHORIZED);
    }

    const isCodeValid = await argon2.verify(otp.codeHash, code);

    if (!isCodeValid) {
      throw new AppError('Invalid or expired OTP.', httpStatus.UNAUTHORIZED);
    }

    await AuthRepository.consumeOtp(otp.id);

    const customer = await AuthRepository.findCustomerByPhone(phone);
    if (customer && !customer.phoneVerifiedAt) {
      await AuthRepository.markCustomerPhoneVerified(customer.id);
    }

    return { message: 'OTP verified successfully.' };
  },

  async loginUserWithOtp(phone: string, gamingCenterId: string) {
    const verificationWindow = new Date(Date.now() - OTP_POST_VERIFICATION_WINDOW_MINUTES * 60 * 1000);

    const recentVerifiedOtp = await AuthRepository.findRecentConsumedOtp(phone, OtpPurpose.LOGIN, verificationWindow);

    if (!recentVerifiedOtp) {
      throw new AppError('No recent OTP verification found. Please verify again.', httpStatus.UNAUTHORIZED);
    }

    const user = await AuthRepository.findUserByPhone(phone, gamingCenterId);
    if (!user) {
      throw new AppError('Invalid credentials for the selected gamingCenter.', httpStatus.UNAUTHORIZED);
    }

    const { accessToken, refreshToken } = await createAndSaveSession(user.id, 'USER');

    return {
      user,
      tokens: { accessToken, refreshToken },
    };
  },

  async loginCustomer(phone: string) {
    let customer = await AuthRepository.findCustomerByPhone(phone);

    if (!customer) {
      customer = await AuthRepository.createCustomer(phone, new Date());
    } else if (!customer.phoneVerifiedAt) {
      customer = await AuthRepository.markCustomerPhoneVerified(customer.id);
    }

    const { accessToken, refreshToken } = await createAndSaveSession(customer.id, 'CUSTOMER');

    return {
      customer,
      tokens: { accessToken, refreshToken },
    };
  },

  async refreshAuthToken(token: string) {
    // The incoming token is the raw refresh token string.
    // 1. Hash the incoming token to find it in the database.
    const tokenHash = hashToken(token);

    // 2. Find the session.
    const session = await AuthRepository.findSessionByToken(tokenHash);
    if (!session || session.revokedAt) {
      throw new AppError('Session is invalid or has been revoked', httpStatus.UNAUTHORIZED);
    }

    // 3. Check for expiration.
    if (new Date() > session.expiresAt) {
      await AuthRepository.revokeSession(session.id);
      throw new AppError('Refresh token has expired', httpStatus.UNAUTHORIZED);
    }

    // 4. Create and return a new access token.
    const newPayload = { sessionId: session.id, actorId: session.actorId, actorType: session.actorType };
    const accessToken = generateAccessToken(newPayload);

    return { accessToken };
  },

  async logout(sessionId: string) {
    await AuthRepository.revokeSession(sessionId);
    return { message: 'Logged out successfully' };
  }
};
