import httpStatus from 'http-status';
import AppError from '../../common/errors/AppError';
import * as uploadStation from '../../common/stations/upload.station';
import { auditService } from '../audit/audit.station';
import logger from '../../config/logger';

export interface ProcessMediaUploadInput {
  file: Express.Multer.File;
  platformAdminId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface MediaUploadResponse {
  url: string;
  thumbUrl: string;
  fileName: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export class PlatformMediaStation {
  /**
   * Validates and processes an uploaded media image on behalf of a Platform Admin.
   * Stores the image via upload.station, generates thumbnail, and records an audit log.
   */
  static async uploadMedia(input: ProcessMediaUploadInput): Promise<MediaUploadResponse> {
    const { file, platformAdminId, ipAddress, userAgent } = input;

    if (!file || !file.buffer) {
      throw new AppError('No image file provided.', httpStatus.BAD_REQUEST);
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      throw new AppError(
        'Invalid file type. Allowed formats: JPEG, PNG, WEBP, GIF.',
        httpStatus.BAD_REQUEST
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new AppError(
        'File size exceeds the 5MB maximum limit.',
        httpStatus.BAD_REQUEST
      );
    }

    // Process and store using system-wide upload station
    const { url, thumbUrl, fileName } = await uploadStation.processAndStoreImage(file);

    // Record audit trail event for media upload
    try {
      await auditService.recordLog({
        platformAdminId,
        action: 'PLATFORM_MEDIA_UPLOAD',
        entity: 'Media',
        entityId: fileName,
        newData: {
          url,
          thumbUrl,
          fileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
        ipAddress,
        userAgent,
      });
    } catch (auditErr) {
      logger.warn({ auditErr, fileName }, 'Platform admin media upload audit logging failed');
    }

    return {
      url,
      thumbUrl,
      fileName,
    };
  }

  /**
   * Safely deletes an existing stored image by its URL when replacing or deleting catalog items.
   */
  static async deleteMediaByUrl(url: string, thumbUrl?: string | null): Promise<void> {
    if (!url || !url.startsWith('/uploads/')) {
      return;
    }
    await uploadStation.deleteStoredImage(url, thumbUrl);
  }
}
