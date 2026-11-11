import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { AdvertisementController } from './advertisement.controller';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only JPEG, PNG, and WebP images are allowed', httpStatus.BAD_REQUEST) as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  },
});

export const advertisementRouter = Router({ mergeParams: true });

advertisementRouter.use(authMiddleware, tenantGuard, requireRole([UserRole.MANAGER, UserRole.ADMIN]));

advertisementRouter.post('/upload', upload.single('banner'), asyncHandler(AdvertisementController.uploadBanner));
advertisementRouter.get('/', asyncHandler(AdvertisementController.list));
advertisementRouter.post('/', asyncHandler(AdvertisementController.create));
advertisementRouter.get('/:id', asyncHandler(AdvertisementController.getById));
advertisementRouter.patch('/:id', asyncHandler(AdvertisementController.update));
advertisementRouter.delete('/:id', asyncHandler(AdvertisementController.delete));
