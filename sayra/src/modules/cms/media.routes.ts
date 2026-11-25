import { Router } from 'express';
import multer from 'multer';
import { validate } from '../../common/middleware/validate';
import {
  createMediaSchema,
  updateMediaSchema,
  uploadMediaSchema,
  deleteMediaSchema,
} from './media.validators';
import * as MediaController from './media.controller';
import * as MediaUploadController from './media.upload.controller';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { ALLOWED_RASTER_IMAGE_MIMES } from '../../common/utils/image-validation';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export const cmsMediaRouter = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_RASTER_IMAGE_MIMES.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          'Only raster images (JPEG, PNG, WebP, GIF, AVIF) are allowed.',
          httpStatus.BAD_REQUEST
        ) as any
      ); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  },
});

cmsMediaRouter.post(
  '/',
  validate(createMediaSchema),
  asyncHandler(MediaController.createMedia)
);

cmsMediaRouter.post(
  '/upload',
  upload.single('file'),
  validate(uploadMediaSchema),
  asyncHandler(MediaUploadController.uploadMedia)
);

cmsMediaRouter.patch(
  '/:mediaId',
  validate(updateMediaSchema),
  asyncHandler(MediaController.updateMedia)
);

cmsMediaRouter.delete(
  '/:mediaId',
  validate(deleteMediaSchema),
  asyncHandler(MediaController.deleteMedia)
);
