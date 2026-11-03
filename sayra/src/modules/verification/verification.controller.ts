import { Response, NextFunction } from 'express';
import { AppRequest } from '../../types/express';
import { VerificationStation } from './verification.station';
import {
  submitVerificationSchema,
  rejectVerificationSchema,
  listVerificationsQuerySchema,
} from './verification.validators';
import { GamingCenterVerificationStatus } from '@prisma/client';

export const VerificationController = {
  // Center Manager: Submit KYC documents
  async submitVerification(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId } = req.params;
      const validated = submitVerificationSchema.parse(req.body) as {
        nationalCardUrl: string;
        idWithSelfieUrl: string;
        businessLicenseUrl: string;
      };
      const result = await VerificationStation.submitVerification(
        gamingCenterId,
        validated,
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
      const { gamingCenterId } = req.params;
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
      const result = await VerificationStation.approveVerification(
        id,
        adminId,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
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
