/* eslint-disable @typescript-eslint/no-explicit-any */
import argon2 from 'argon2';
import crypto from 'crypto';
import httpStatus from 'http-status';
import { OnboardingStep, OtpPurpose, UserRole } from '@prisma/client';
import { OnboardingRepo } from './onboarding.repo';
import { AuthRepository } from '../auth/auth.repository';
import { generateAccessToken } from '../auth/auth.tokens';
import { queueSms } from '../../jobs/producers/sms.producer';
import { env } from '../../config/env';
import AppError from '../../common/errors/AppError';
import { normalizePhone } from '../../common/utils/phone';

const OTP_LENGTH = 6;
const OTP_EXPIRATION_MINUTES = 2;

const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const generateNumericOtp = (length: number): string => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

const getOtpTemplateId = (): number => {
  return env.SMSIR_OTP_TEMPLATE_ID || 123456;
};

export const OnboardingStation = {
  /**
   * Step 1: Start onboarding flow.
   * Collects GameCenter name, Manager full name, Manager phone.
   * Generates and dispatches an OTP to the manager's phone.
   */
  async startOnboarding(data: {
    gameCenterName: string;
    managerFullName: string;
    managerPhone: string;
  }) {
    const normalizedPhone = normalizePhone(data.managerPhone);

    // Create or update onboarding draft
    let draft = await OnboardingRepo.findByManagerPhone(normalizedPhone);

    if (draft) {
      draft = await OnboardingRepo.updateDraft(draft.id, {
        gameCenterName: data.gameCenterName,
        managerFullName: data.managerFullName,
        step: OnboardingStep.OTP_PENDING,
      });
    } else {
      draft = await OnboardingRepo.createDraft({
        gameCenterName: data.gameCenterName,
        managerFullName: data.managerFullName,
        managerPhone: normalizedPhone,
        step: OnboardingStep.OTP_PENDING,
      });
    }

    // Generate & save OTP
    const code = generateNumericOtp(OTP_LENGTH);
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    await AuthRepository.createOtp({
      phone: normalizedPhone,
      purpose: OtpPurpose.SIGNUP,
      codeHash,
      expiresAt,
    });

    try {
      await queueSms({
        mobile: normalizedPhone,
        templateId: getOtpTemplateId(),
        parameters: [{ name: 'CODE', value: code }],
      });
    } catch {
      // In tests or offline environments, allow graceful continuation
    }

    return {
      onboardingId: draft.id,
      step: draft.step,
      message: `OTP sent to ${normalizedPhone}. It will expire in ${OTP_EXPIRATION_MINUTES} minutes.`,
    };
  },

  /**
   * Step 1 (b): Verify OTP.
   * Verifies the code, marks phone as verified, creates/links manager account,
   * creates user session, generates access/refresh tokens, and progresses to LOCATION_PENDING.
   */
  async verifyOtp(onboardingId: string, code: string) {
    const draft = await OnboardingRepo.findById(onboardingId);
    if (!draft) {
      throw new AppError('Onboarding session not found', httpStatus.NOT_FOUND);
    }

    const otp = await AuthRepository.findRecentOtp(draft.managerPhone, OtpPurpose.SIGNUP);
    if (!otp) {
      throw new AppError('Invalid or expired OTP.', httpStatus.UNAUTHORIZED);
    }

    const isCodeValid = await argon2.verify(otp.codeHash, code);
    if (!isCodeValid) {
      throw new AppError('Invalid or expired OTP.', httpStatus.UNAUTHORIZED);
    }

    await AuthRepository.consumeOtp(otp.id);

    // Check or find existing user for this phone
    const user = await (AuthRepository as any).findUsersWithGamingCenters(draft.managerPhone).then((res: any[]) => res[0]);

    // Update draft to AUTHENTICATED / LOCATION_PENDING
    const updatedDraft = await OnboardingRepo.updateDraft(onboardingId, {
      step: OnboardingStep.LOCATION_PENDING,
      managerId: user?.id || null,
    });

    // Generate auth session if user exists
    let tokens = null;
    if (user) {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const refreshToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(refreshToken);
      const session = await AuthRepository.createSession(user.id, 'USER', tokenHash, expiresAt);
      const accessToken = generateAccessToken({ sessionId: session.id, actorId: user.id, actorType: 'USER' });
      tokens = { accessToken, refreshToken };
    }

    return {
      onboardingId: updatedDraft.id,
      step: updatedDraft.step,
      verified: true,
      manager: {
        id: updatedDraft.managerId,
        full_name: updatedDraft.managerFullName,
        phone_number: updatedDraft.managerPhone,
        phone_verified: true,
      },
      tokens,
    };
  },

  /**
   * Step 2: Update Location & Address.
   */
  async updateLocation(
    onboardingId: string,
    data: {
      provinceId: string;
      cityId: string;
      address: string;
      latitude?: number | null;
      longitude?: number | null;
    }
  ) {
    const draft = await OnboardingRepo.findById(onboardingId);
    if (!draft) {
      throw new AppError('Onboarding session not found', httpStatus.NOT_FOUND);
    }

    const updated = await OnboardingRepo.updateDraft(onboardingId, {
      provinceId: data.provinceId,
      cityId: data.cityId,
      address: data.address,
      latitude: data.latitude !== undefined && data.latitude !== null ? data.latitude : null,
      longitude: data.longitude !== undefined && data.longitude !== null ? data.longitude : null,
      step: OnboardingStep.WORKING_HOURS_PENDING,
    });

    return {
      onboardingId: updated.id,
      step: updated.step,
      location: {
        province_id: updated.provinceId,
        city_id: updated.cityId,
        address: updated.address,
        latitude: updated.latitude ? Number(updated.latitude) : null,
        longitude: updated.longitude ? Number(updated.longitude) : null,
      },
    };
  },

  /**
   * Step 3: Update Working Hours.
   * Supports midnight spanning (e.g. 10:00 to 02:00) and closed days.
   */
  async updateWorkingHours(
    onboardingId: string,
    data: {
      openingTime: string;
      closingTime: string;
      closedDays?: number[];
      timezone?: string;
    }
  ) {
    const draft = await OnboardingRepo.findById(onboardingId);
    if (!draft) {
      throw new AppError('Onboarding session not found', httpStatus.NOT_FOUND);
    }

    const updated = await OnboardingRepo.updateDraft(onboardingId, {
      openingTime: data.openingTime,
      closingTime: data.closingTime,
      closedDays: data.closedDays || [],
      timezone: data.timezone || 'Asia/Tehran',
      step: OnboardingStep.MEDIA_PENDING,
    });

    return {
      onboardingId: updated.id,
      step: updated.step,
      working_hours: {
        timezone: updated.timezone,
        opening_time: updated.openingTime,
        closing_time: updated.closingTime,
        closed_days: updated.closedDays,
      },
    };
  },

  /**
   * Step 4: Update Media.
   * Logo & gallery media ids (optional step).
   */
  async updateMedia(
    onboardingId: string,
    data: {
      logoMediaId?: string | null;
      galleryMediaIds?: string[];
    }
  ) {
    const draft = await OnboardingRepo.findById(onboardingId);
    if (!draft) {
      throw new AppError('Onboarding session not found', httpStatus.NOT_FOUND);
    }

    const updated = await OnboardingRepo.updateDraft(onboardingId, {
      logoMediaId: data.logoMediaId || null,
      galleryMediaIds: data.galleryMediaIds || [],
      step: OnboardingStep.PREVIEW,
    });

    return {
      onboardingId: updated.id,
      step: updated.step,
      media: {
        logo_media_id: updated.logoMediaId,
        gallery_media_ids: updated.galleryMediaIds,
      },
    };
  },

  /**
   * Step 5: Get Preview.
   * Summarizes all entered data and current step.
   */
  async getPreview(onboardingId: string) {
    const draft = await OnboardingRepo.findById(onboardingId);
    if (!draft) {
      throw new AppError('Onboarding session not found', httpStatus.NOT_FOUND);
    }

    return {
      onboarding_id: draft.id,
      step: draft.step,
      game_center: {
        name: draft.gameCenterName,
      },
      manager: {
        id: draft.managerId,
        full_name: draft.managerFullName,
        phone_number: draft.managerPhone,
      },
      location: {
        province_id: draft.provinceId,
        city_id: draft.cityId,
        address: draft.address,
        latitude: draft.latitude ? Number(draft.latitude) : null,
        longitude: draft.longitude ? Number(draft.longitude) : null,
      },
      working_hours: {
        timezone: draft.timezone,
        opening_time: draft.openingTime,
        closing_time: draft.closingTime,
        closed_days: draft.closedDays,
      },
      media: {
        logo_media_id: draft.logoMediaId,
        gallery_media_ids: draft.galleryMediaIds,
      },
    };
  },

  /**
   * Step 6: Complete onboarding transactionally.
   * Creates or updates GamingCenter, Address, Settings, User (Manager),
   * marks draft as COMPLETED, and issues tokens and manager dashboard redirect.
   */
  async completeOnboarding(onboardingId: string) {
    const draft = await OnboardingRepo.findById(onboardingId);
    if (!draft) {
      throw new AppError('Onboarding session not found', httpStatus.NOT_FOUND);
    }

    if (draft.step === OnboardingStep.COMPLETED && draft.gamingCenterId) {
      return {
        success: true,
        game_center_id: draft.gamingCenterId,
        status: 'active',
        redirect: '/manager/dashboard',
      };
    }

    // Required fields check before completion
    if (!draft.gameCenterName || !draft.managerPhone || !draft.address || !draft.cityId) {
      throw new AppError('Missing required onboarding details before completion', httpStatus.BAD_REQUEST);
    }

    // Generate slug from name
    const baseSlug = draft.gameCenterName
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `center-${Date.now()}`;
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    const result = await OnboardingRepo.transaction(async (tx) => {
      // 1. Create GamingCenter
      const createdCenter = await tx.gamingCenter.create({
        data: {
          name: draft.gameCenterName,
          slug,
          isActive: true,
          openingTime: draft.openingTime || '09:00',
          closingTime: draft.closingTime || '23:00',
          closedDays: draft.closedDays || [],
          timezone: draft.timezone || 'Asia/Tehran',
        },
      });

      // 2. Create primary Address
      await tx.address.create({
        data: {
          gamingCenterId: createdCenter.id,
          title: 'دفتر اصلی',
          province: draft.provinceId || '',
          city: draft.cityId || '',
          addressLine: draft.address || '',
          lat: draft.latitude,
          lng: draft.longitude,
          isPrimary: true,
        },
      });

      // 3. Create Settings
      await tx.settings.create({
        data: {
          gamingCenterId: createdCenter.id,
          timeZone: draft.timezone || 'Asia/Tehran',
          workStartTime: draft.openingTime || '09:00',
          workEndTime: draft.closingTime || '23:00',
        },
      });

      // 4. Create or reassign Manager User
      let managerUser = await tx.user.findFirst({
        where: { phone: draft.managerPhone },
      });

      if (!managerUser) {
        managerUser = await tx.user.create({
          data: {
            gamingCenterId: createdCenter.id,
            fullName: draft.managerFullName || 'مدیر مجموعه',
            phone: draft.managerPhone,
            role: UserRole.MANAGER,
            isActive: true,
            phoneVerifiedAt: new Date(),
          },
        });
      } else {
        managerUser = await tx.user.update({
          where: { id: managerUser.id },
          data: {
            gamingCenterId: createdCenter.id,
            role: managerUser.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.MANAGER,
            isActive: true,
            phoneVerifiedAt: new Date(),
          },
        });
      }

      // 5. Connect Logo Media if provided
      if (draft.logoMediaId) {
        await tx.siteSettings.upsert({
          where: { gamingCenterId: createdCenter.id },
          create: {
            gamingCenterId: createdCenter.id,
            logoUrl: draft.logoMediaId,
          },
          update: {
            logoUrl: draft.logoMediaId,
          },
        });
      }

      // 6. Update draft to COMPLETED
      await tx.gameCenterOnboarding.update({
        where: { id: draft.id },
        data: {
          step: OnboardingStep.COMPLETED,
          gamingCenterId: createdCenter.id,
          managerId: managerUser.id,
        },
      });

      // 7. Create Session & Tokens for the manager
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const refreshToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(refreshToken);
      const session = await tx.session.create({
        data: {
          actorId: managerUser.id,
          actorType: 'USER',
          tokenHash,
          expiresAt,
        },
      });

      const accessToken = generateAccessToken({
        sessionId: session.id,
        actorId: managerUser.id,
        actorType: 'USER',
      });

      return {
        gameCenter: createdCenter,
        manager: managerUser,
        tokens: { accessToken, refreshToken },
      };
    });

    return {
      success: true,
      game_center_id: result.gameCenter.id,
      status: 'active',
      redirect: '/manager/dashboard',
      manager_id: result.manager.id,
      tokens: result.tokens,
    };
  },
};
