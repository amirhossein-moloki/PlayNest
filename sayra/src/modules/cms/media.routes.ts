import { Router } from 'express';
import multer from 'multer';
import { validate } from '../../common/middleware/validate';
import {
  createMediaSchema,
  updateMediaSchema,
  uploadMediaSchema,
} from './media.validators';
import * as MediaController from './media.controller';
import * as MediaUploadController from './media.upload.controller';
import { asyncHandler } from '../../common/middleware/asyncHandler';

export const cmsMediaRouter = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed') as any); // eslint-disable-line @typescript-eslint/no-explicit-any
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
