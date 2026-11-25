/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import httpStatus from 'http-status';
import { OnboardingStep, OtpPurpose, SessionActorType, UserRole, NotificationType } from '@prisma/client';
import { OnboardingRepo } from './onboarding.repo';
import { OtpService } from '../auth/otp.service';
import { generateAccessToken } from '../auth/auth.tokens';
import { NotificationStation } from '../notifications/notifications.station';
import { env } from '../../config/env';
import AppError from '../../common/errors/AppError';
import { normalizePhone } from '../../common/utils/phone';
import { CommissionsRepo } from '../commissions/commissions.repo';

const ONBOARDING_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const signOnboardingToken = (onboardingId: string, managerPhone: string): string => {
  const payload = Buffer.from(
    JSON.stringify({
      oid: onboardingId,
      phone: managerPhone,
      exp: Date.now() + ONBOARDING_TOKEN_TTL_MS,
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(`onboarding:${payload}`)
    .digest('base64url');
  return `${payload}.${sig}`;
};

export const verifyOnboardingToken = (
  token: string | undefined,
  onboardingId: string,
  managerPhone: string
): void => {
  if (!token || !token.includes('.')) {
    throw new AppError('Valid onboarding session token is required.', httpStatus.UNAUTHORIZED);
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new AppError('Invalid onboarding session token.', httpStatus.UNAUTHORIZED);
  }
  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(`onboarding:${payloadB64}`)
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new AppError('Invalid onboarding session token.', httpStatus.UNAUTHORIZED);
  }

  let parsed: { oid?: string; phone?: string; exp?: number };
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw new AppError('Malformed onboarding session token.', httpStatus.UNAUTHORIZED);
  }

  if (
    parsed.oid !== onboardingId ||
    parsed.phone !== managerPhone ||
    typeof parsed.exp !== 'number' ||
    parsed.exp <= Date.now()
  ) {
    throw new AppError('Onboarding session token has expired or does not match draft.', httpStatus.UNAUTHORIZED);
  }
};

const requireVerifiedDraft = async (onboardingId: string, onboardingToken?: string) => {
  const draft = await OnboardingRepo.findById(onboardingId);
  if (!draft) {
    throw new AppError('Onboarding session not found', httpStatus.NOT_FOUND);
  }
  if (draft.step === OnboardingStep.OTP_PENDING) {
    throw new AppError('Phone OTP verification must be completed before proceeding.', httpStatus.FORBIDDEN);
  }
  verifyOnboardingToken(onboardingToken, draft.id, draft.managerPhone);
  return draft;
};

export const OnboardingStation = {
  /**
   * Step 1: Start onboarding flow.
   * Always creates a fresh draft so unfinished draft IDs for other callers are never leaked.
   * Generates and dispatches a SIGNUP OTP via OtpService.
   */
  async startOnboarding(
    data: {
      gameCenterName: string;
      managerFullName: string;
      managerPhone: string;
    },
    metadata?: { ip?: string; userAgent?: string }
  ) {
    const normalizedPhone = normalizePhone(data.managerPhone);

    const draft = await OnboardingRepo.createDraft({
      gameCenterName: data.gameCenterName,
      managerFullName: data.managerFullName,
      managerPhone: normalizedPhone,
      step: OnboardingStep.OTP_PENDING,
    });

    const otpResult = await OtpService.requestOtp(
      normalizedPhone,
      OtpPurpose.SIGNUP,
      metadata,
      SessionActorType.USER
    );

    return {
      onboardingId: draft.id,
      step: draft.step,
      message: otpResult.message,
    };
  },

  /**
   * Step 1 (b): Verify OTP.
   * Verifies the SIGNUP OTP via OtpService and returns an HMAC-signed onboardingToken
   * scoped strictly to this draft ID and managerPhone. Does not issue User login JWTs.
   */
  async verifyOtp(onboardingId: string, code: string, metadata?: { ip?: string }) {
    const draft = await OnboardingRepo.findById(onboardingId);
    if (!draft) {
      throw new AppError('Onboarding session not found', httpStatus.NOT_FOUND);
    }

    await OtpService.verifyAndConsumeOtp(
      draft.managerPhone,
      code,
      OtpPurpose.SIGNUP,
      metadata,
      SessionActorType.USER
    );

    const updatedDraft = await OnboardingRepo.updateDraft(onboardingId, {
      step: OnboardingStep.LOCATION_PENDING,
      managerId: null,
    });

    const onboardingToken = signOnboardingToken(updatedDraft.id, updatedDraft.managerPhone);

    return {
      onboardingId: updatedDraft.id,
      step: updatedDraft.step,
      verified: true,
      onboardingToken,
      manager: {
        id: updatedDraft.managerId,
        full_name: updatedDraft.managerFullName,
        phone_number: updatedDraft.managerPhone,
        phone_verified: true,
      },
      tokens: null,
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
    },
    onboardingToken?: string
  ) {
    await requireVerifiedDraft(onboardingId, onboardingToken);

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
    },
    onboardingToken?: string
  ) {
    await requireVerifiedDraft(onboardingId, onboardingToken);

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
    },
    onboardingToken?: string
  ) {
    await requireVerifiedDraft(onboardingId, onboardingToken);

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
  async getPreview(onboardingId: string, onboardingToken?: string) {
    const draft = await requireVerifiedDraft(onboardingId, onboardingToken);

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
   * Creates GamingCenter, Address, Settings, and a fresh User (Manager).
   * Refuses completion if any existing User already owns draft.managerPhone.
   */
  async completeOnboarding(onboardingId: string, onboardingToken?: string) {
    const draft = await requireVerifiedDraft(onboardingId, onboardingToken);

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

    // Generate clean Unicode-aware slug from name (preserving Persian / Arabic letters)
    const cleanName = draft.gameCenterName
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');
    const baseSlug = cleanName || `center-${Date.now()}`;
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    const result = await OnboardingRepo.transaction(async (tx) => {
      // 1. Refuse onboarding if phone already belongs to any existing User (prevents account hijacking/reactivation)
      const existingUser = await tx.user.findFirst({
        where: { phone: draft.managerPhone },
        select: { id: true },
      });

      if (existingUser) {
        throw new AppError(
          'A user account with this phone number already exists.',
          httpStatus.CONFLICT
        );
      }

      // 2. Create GamingCenter
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

      // 3. Create primary Address
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

      // 4. Create Settings
      await tx.settings.create({
        data: {
          gamingCenterId: createdCenter.id,
          timeZone: draft.timezone || 'Asia/Tehran',
          workStartTime: draft.openingTime || '09:00',
          workEndTime: draft.closingTime || '23:00',
        },
      });

      // 4b. Provision default CommissionPolicy based on PlatformSetting.platformCommissionPercent
      if (typeof CommissionsRepo?.ensureDefaultPolicyForGamingCenter === 'function') {
        await CommissionsRepo.ensureDefaultPolicyForGamingCenter(createdCenter.id, tx);
      }

      // 5. Create fresh Manager User
      const managerUser = await tx.user.create({
        data: {
          gamingCenterId: createdCenter.id,
          fullName: draft.managerFullName || 'مدیر مجموعه',
          phone: draft.managerPhone,
          role: UserRole.MANAGER,
          isActive: true,
          phoneVerifiedAt: new Date(),
        },
      });

      // Link GamingCenter to Manager (1-to-1 relation)
      await tx.gamingCenter.update({
        where: { id: createdCenter.id },
        data: {
          managerId: managerUser.id,
        },
      });

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

    // Notify managers of new GameCenter registration (In-App only)
    NotificationStation.notifyManagers({
      type: NotificationType.NEW_GAME_CENTER_REGISTRATION,
      templateKey: 'NEW_GAME_CENTER_REGISTRATION',
      templateParams: {
        gameCenterName: result.gameCenter.name,
      },
      entityType: 'GamingCenter',
      entityId: result.gameCenter.id,
    }).catch(console.error);

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
