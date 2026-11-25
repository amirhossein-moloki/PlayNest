import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { VerificationController } from './verification.controller';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { ALLOWED_KYC_IMAGE_MIMES } from '../../common/utils/image-validation';

const licenseUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_KYC_IMAGE_MIMES.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new AppError('فایل پروانه کسب باید تصویر معتبر باشد (JPEG، PNG یا WebP، حداکثر ۵ مگابایت)', httpStatus.BAD_REQUEST));
    }
  },
});

export const uploadLicenseMiddleware = (req: Request, res: Response, next: NextFunction) => {
  licenseUpload.fields([
    { name: 'businessLicense', maxCount: 1 },
    { name: 'license', maxCount: 1 },
    { name: 'licenseImage', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ])(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('حجم عکس پروانه کسب نباید بیشتر از ۵ مگابایت باشد', httpStatus.BAD_REQUEST));
      }
      if (err instanceof AppError) {
        return next(err);
      }
      return next(new AppError(err.message || 'خطا در بارگذاری فایل پروانه کسب', httpStatus.BAD_REQUEST));
    }

    // Normalize req.file if files object exists
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    if (files) {
      req.file =
        files.businessLicense?.[0] ||
        files.license?.[0] ||
        files.licenseImage?.[0] ||
        files.file?.[0] ||
        undefined;
    }

    next();
  });
};

export const gamingCenterVerificationRouter = Router({ mergeParams: true });

gamingCenterVerificationRouter.use(authMiddleware, tenantGuard, requireRole([UserRole.MANAGER, UserRole.ADMIN]));

gamingCenterVerificationRouter.post('/', uploadLicenseMiddleware, asyncHandler(VerificationController.submitVerification));
gamingCenterVerificationRouter.get('/', asyncHandler(VerificationController.getVerificationStatus));
