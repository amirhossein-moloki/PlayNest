/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { GamingCenterVerificationStatus, SessionActorType } from '@prisma/client';
import { VerificationRepo } from './verification.repo';
import AppError from '../../common/errors/AppError';
import { auditService } from '../audit/audit.station';
import { prisma } from '../../config/prisma';
import { invalidateTenantCache } from '../../common/utils/tenantCache';
import { invalidatePublicCacheByPrefix } from '../../common/utils/publicCache';
import { recordGamingCenterChangeEvent } from '../integrations/outbox.service';

export const VerificationStation = {
  /**
   * Submit verification documents by GamingCenter Manager/Admin
   * Documents and information:
   * 1. Owner Full Name (نام و نام خانوادگی)
   * 2. Phone Number (شماره تماس)
   * 3. Gaming Center Name (نام گیم‌نت)
   * 4. Business License / Activity permit photo (پروانه کسب - حداکثر ۵ مگابایت)
   */
  async submitVerification(
    gamingCenterId: string,
    data: {
      ownerFullName?: string;
      phoneNumber?: string;
      gamingCenterName?: string;
      businessLicenseUrl: string;
      nationalCardUrl?: string | null;
      idWithSelfieUrl?: string | null;
    },
    actor?: { id: string; actorType: SessionActorType; fullName?: string; phone?: string },
    context?: { ip?: string; userAgent?: string }
  ) {
    const center = await (prisma as any).gamingCenter.findUnique({
      where: { id: gamingCenterId },
      include: {
        users: {
          where: { role: 'MANAGER' },
          select: { id: true, fullName: true, phone: true },
        },
      },
    });

    if (!center) {
      throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
    }

    const manager = center.users && center.users.length > 0 ? center.users[0] : null;
    const ownerFullName = data.ownerFullName || manager?.fullName || (actor as any)?.fullName || null;
    const phoneNumber = data.phoneNumber || manager?.phone || (actor as any)?.phone || null;
    const gamingCenterName = data.gamingCenterName || center.name;

    const result = await VerificationRepo.transaction(async (tx: any) => {
      // Create new verification submission
      const record = await tx.gamingCenterVerification.create({
        data: {
          gamingCenterId,
          ownerFullName,
          phoneNumber,
          gamingCenterName,
          businessLicenseUrl: data.businessLicenseUrl,
          nationalCardUrl: data.nationalCardUrl || null,
          idWithSelfieUrl: data.idWithSelfieUrl || null,
          status: GamingCenterVerificationStatus.PENDING,
        },
      });

      // Update GamingCenter status to PENDING
      await tx.gamingCenter.update({
        where: { id: gamingCenterId },
        data: {
          name: gamingCenterName,
          verificationStatus: GamingCenterVerificationStatus.PENDING,
          rejectionReason: null,
        },
      });

      return record;
    });

    if (actor) {
      await auditService.log(
        gamingCenterId,
        actor,
        'SETTINGS_UPDATE',
        { name: 'GamingCenterVerification', id: result.id },
        {
          new: {
            action: 'VERIFICATION_SUBMITTED',
            status: GamingCenterVerificationStatus.PENDING,
            ownerFullName,
            phoneNumber,
            gamingCenterName,
          },
        },
        context
      );
    }

    return {
      success: true,
      verificationId: result.id,
      gamingCenterId,
      status: result.status,
      ownerFullName: result.ownerFullName,
      phoneNumber: result.phoneNumber,
      gamingCenterName: result.gamingCenterName,
      businessLicenseUrl: result.businessLicenseUrl,
      message: 'مدارک احراز هویت با موفقیت ثبت شد و در انتظار بررسی مدیریت سیستم است.',
    };
  },

  /**
   * Get verification status and latest documents for a gaming center
   */
  async getVerificationStatus(gamingCenterId: string) {
    const center = await (prisma as any).gamingCenter.findUnique({
      where: { id: gamingCenterId },
      select: {
        id: true,
        name: true,
        verificationStatus: true,
        verifiedAt: true,
        rejectionReason: true,
      },
    });

    if (!center) {
      throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
    }

    const latestVerification = await VerificationRepo.findLatestByGamingCenterId(gamingCenterId);

    return {
      gamingCenterId: center.id,
      name: center.name,
      verificationStatus: center.verificationStatus,
      verifiedAt: center.verifiedAt,
      rejectionReason: center.rejectionReason,
      latestVerification: latestVerification || null,
    };
  },

  /**
   * Platform Admin: List verification requests with filters and pagination
   */
  async listVerifications(query: {
    status?: GamingCenterVerificationStatus;
    page: number;
    limit: number;
  }) {
    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }

    const skip = (query.page - 1) * query.limit;
    const { items, total } = await VerificationRepo.listVerifications({
      where,
      skip,
      take: query.limit,
    });

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems: total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  },

  /**
   * Platform Admin: Get single verification request details
   */
  async getVerificationDetails(id: string) {
    const verification = await VerificationRepo.findById(id);
    if (!verification) {
      throw new AppError('Verification request not found', httpStatus.NOT_FOUND);
    }
    return verification;
  },

  /**
   * Platform Admin: Approve verification request
   */
  async approveVerification(
    id: string,
    adminId: string,
    actor?: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string },
    sayraBaseline?: { sayraRating?: number; sayraReviewComment?: string }
  ) {
    const verification = await VerificationRepo.findById(id);
    if (!verification) {
      throw new AppError('Verification request not found', httpStatus.NOT_FOUND);
    }

    const now = new Date();

    const updated = await VerificationRepo.transaction(async (tx: any) => {
      const record = await tx.gamingCenterVerification.update({
        where: { id },
        data: {
          status: GamingCenterVerificationStatus.APPROVED,
          reviewerAdminId: adminId,
          reviewedAt: now,
          rejectionReason: null,
        },
      });

      await tx.gamingCenter.update({
        where: { id: verification.gamingCenterId },
        data: {
          verificationStatus: GamingCenterVerificationStatus.APPROVED,
          verifiedAt: now,
          rejectionReason: null,
          ...(sayraBaseline?.sayraRating !== undefined
            ? {
                sayraRating: sayraBaseline.sayraRating,
                sayraReviewComment: sayraBaseline.sayraReviewComment ?? null,
                sayraRatedAt: now,
                sayraRatedByAdminId: adminId,
              }
            : {}),
        },
      });

      return record;
    });

    void invalidateTenantCache(verification.gamingCenterId);
    void invalidatePublicCacheByPrefix('public:gc:');
    void recordGamingCenterChangeEvent({
      gamingCenterId: verification.gamingCenterId,
      eventType: 'GAMING_CENTER_STATUS_CHANGED',
      changedFields: ['verificationStatus'],
      metadata: { verificationStatus: 'APPROVED' },
    });

    if (actor) {
      await auditService.log(
        verification.gamingCenterId,
        actor,
        'SALON_UPDATE',
        { name: 'GamingCenterVerification', id },
        {
          new: {
            action: 'VERIFICATION_APPROVED',
            adminId,
            gamingCenterId: verification.gamingCenterId,
          },
        },
        context
      );
    }

    return {
      success: true,
      status: updated.status,
      gamingCenterId: verification.gamingCenterId,
      reviewedAt: updated.reviewedAt,
      message: 'احراز هویت گیم‌نت با موفقیت تأیید شد.',
    };
  },

  /**
   * Platform Admin: Reject verification request with reason
   */
  async rejectVerification(
    id: string,
    adminId: string,
    rejectionReason: string,
    actor?: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const verification = await VerificationRepo.findById(id);
    if (!verification) {
      throw new AppError('Verification request not found', httpStatus.NOT_FOUND);
    }

    const now = new Date();

    const updated = await VerificationRepo.transaction(async (tx: any) => {
      const record = await tx.gamingCenterVerification.update({
        where: { id },
        data: {
          status: GamingCenterVerificationStatus.REJECTED,
          reviewerAdminId: adminId,
          reviewedAt: now,
          rejectionReason,
        },
      });

      await tx.gamingCenter.update({
        where: { id: verification.gamingCenterId },
        data: {
          verificationStatus: GamingCenterVerificationStatus.REJECTED,
          rejectionReason,
          verifiedAt: null,
        },
      });

      return record;
    });

    void invalidateTenantCache(verification.gamingCenterId);
    void invalidatePublicCacheByPrefix('public:gc:');
    void recordGamingCenterChangeEvent({
      gamingCenterId: verification.gamingCenterId,
      eventType: 'GAMING_CENTER_STATUS_CHANGED',
      changedFields: ['verificationStatus'],
      metadata: { verificationStatus: 'REJECTED' },
    });

    if (actor) {
      await auditService.log(
        verification.gamingCenterId,
        actor,
        'SALON_UPDATE',
        { name: 'GamingCenterVerification', id },
        {
          new: {
            action: 'VERIFICATION_REJECTED',
            adminId,
            gamingCenterId: verification.gamingCenterId,
            rejectionReason,
          },
        },
        context
      );
    }

    return {
      success: true,
      status: updated.status,
      gamingCenterId: verification.gamingCenterId,
      rejectionReason: updated.rejectionReason,
      reviewedAt: updated.reviewedAt,
      message: 'درخواست احراز هویت رد شد.',
    };
  },
};
