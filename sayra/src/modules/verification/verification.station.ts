/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { GamingCenterVerificationStatus, SessionActorType } from '@prisma/client';
import { VerificationRepo } from './verification.repo';
import AppError from '../../common/errors/AppError';
import { auditService } from '../audit/audit.station';
import { prisma } from '../../config/prisma';

export const VerificationStation = {
  /**
   * Submit verification documents by GamingCenter Manager/Admin
   * Documents:
   * 1. National Card / Shenasnameh photo
   * 2. Selfie holding National ID / Shenasnameh
   * 3. Business license / Activity permit photo
   */
  async submitVerification(
    gamingCenterId: string,
    data: {
      nationalCardUrl: string;
      idWithSelfieUrl: string;
      businessLicenseUrl: string;
    },
    actor?: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const center = await (prisma as any).gamingCenter.findUnique({
      where: { id: gamingCenterId },
    });

    if (!center) {
      throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
    }

    const result = await VerificationRepo.transaction(async (tx: any) => {
      // Create new verification submission
      const record = await tx.gamingCenterVerification.create({
        data: {
          gamingCenterId,
          nationalCardUrl: data.nationalCardUrl,
          idWithSelfieUrl: data.idWithSelfieUrl,
          businessLicenseUrl: data.businessLicenseUrl,
          status: GamingCenterVerificationStatus.PENDING,
        },
      });

      // Update GamingCenter status to PENDING
      await tx.gamingCenter.update({
        where: { id: gamingCenterId },
        data: {
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
          },
        },
        context
      );
    }

    return {
      success: true,
      verificationId: result.id,
      status: result.status,
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
        },
      });

      return record;
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
          },
        },
        context
      );
    }

    return {
      success: true,
      status: updated.status,
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
        },
      });

      return record;
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
            rejectionReason,
          },
        },
        context
      );
    }

    return {
      success: true,
      status: updated.status,
      rejectionReason: updated.rejectionReason,
      reviewedAt: updated.reviewedAt,
      message: 'درخواست احراز هویت رد شد.',
    };
  },
};
