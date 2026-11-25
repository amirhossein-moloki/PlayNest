import path from 'path';
import { Response, NextFunction } from 'express';
import { AppRequest } from '../../types/express';
import { VerificationStation } from './verification.station';
import {
  submitVerificationSchema,
  approveVerificationSchema,
  rejectVerificationSchema,
  listVerificationsQuerySchema,
} from './verification.validators';
import { GamingCenterVerificationStatus } from '@prisma/client';
import { getStorageAdapter } from '../media/storage';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export const VerificationController = {
  // Center Manager: Submit KYC documents
  async submitVerification(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const gamingCenterId = req.params.gamingCenterId || (req.actor as any)?.gamingCenterId;
      if (!gamingCenterId) {
        throw new AppError('Gaming center ID is required', httpStatus.BAD_REQUEST);
      }

      const validated = submitVerificationSchema.parse(req.body);

      // Handle uploaded file if present
      if (req.file) {
        const adapter = getStorageAdapter();
        const ext = path.extname(req.file.originalname) || '.jpg';
        const storageKey = `gamingCenters/${gamingCenterId}/verification/license-${Date.now()}${ext}`;
        const uploadResult = await adapter.upload({
          key: storageKey,
          body: req.file.buffer,
          contentType: req.file.mimetype,
          cacheControl: 'public, max-age=31536000, immutable',
        });
        validated.businessLicenseUrl = uploadResult.url;
      }

      if (!validated.businessLicenseUrl) {
        throw new AppError('ارسال تصویر پروانه کسب الزامی است (حداکثر ۵ مگابایت)', httpStatus.BAD_REQUEST);
      }

      const result = await VerificationStation.submitVerification(
        gamingCenterId,
        {
          ownerFullName: validated.ownerFullName,
          phoneNumber: validated.phoneNumber,
          gamingCenterName: validated.gamingCenterName,
          businessLicenseUrl: validated.businessLicenseUrl,
          nationalCardUrl: validated.nationalCardUrl,
          idWithSelfieUrl: validated.idWithSelfieUrl,
        },
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      return res.created(result);
    } catch (err) {
      next(err);
    }
  },

  // Center Manager: Get verification status
  async getVerificationStatus(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const gamingCenterId = req.params.gamingCenterId || (req.actor as any)?.gamingCenterId;
      if (!gamingCenterId) {
        throw new AppError('Gaming center ID is required', httpStatus.BAD_REQUEST);
      }
      const result = await VerificationStation.getVerificationStatus(gamingCenterId);
      return res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  // Platform Admin: List verification submissions
  async listVerifications(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const query = listVerificationsQuerySchema.parse(req.query);
      const result = await VerificationStation.listVerifications({
        status: query.status as GamingCenterVerificationStatus | undefined,
        page: query.page,
        limit: query.limit,
      });
      return res.ok(result.items, {
        pagination: {
          page: result.pagination.page,
          pageSize: result.pagination.limit,
          totalItems: result.pagination.totalItems,
          totalPages: result.pagination.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  // Platform Admin: Get verification request details
  async getVerificationDetails(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await VerificationStation.getVerificationDetails(id);
      return res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  // Platform Admin: Approve verification
  async approveVerification(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const adminId = req.actor.id;
      const validated = approveVerificationSchema.parse(req.body);
      const result = await VerificationStation.approveVerification(
        id,
        adminId,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string },
        validated
      );
      return res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  // Platform Admin: Reject verification with reason
  async rejectVerification(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const adminId = req.actor.id;
      const validated = rejectVerificationSchema.parse(req.body);
      const result = await VerificationStation.rejectVerification(
        id,
        adminId,
        validated.rejectionReason,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      return res.ok(result);
    } catch (err) {
      next(err);
    }
  },
};
