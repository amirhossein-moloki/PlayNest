import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import httpStatus from 'http-status';
import AppError from '../errors/AppError';
import { env } from '../../config/env';
import {
  ALL_RASTER_FORMATS,
  validateAndReencodeRasterImage,
} from '../utils/image-validation';

const UPLOAD_ROOT = 'uploads';
const THUMB_DIR_NAME = 'thumbnails';
const THUMB_ROOT = path.join(UPLOAD_ROOT, THUMB_DIR_NAME);

/**
 * Ensures that upload directories exist.
 */
export async function ensureUploadDirs() {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await fs.mkdir(THUMB_ROOT, { recursive: true });
}

/**
 * Process an uploaded image: validate and re-encode in memory first, then persist original and thumbnail.
 * Returns the relative URLs for both.
 */
export async function processAndStoreImage(file: Express.Multer.File) {
  const validated = await validateAndReencodeRasterImage(file.buffer, {
    allowedFormats: ALL_RASTER_FORMATS,
  });

  let thumbBuffer: Buffer;
  try {
    thumbBuffer = await sharp(validated.buffer, { failOnError: true })
      .resize(300, 300, {
        fit: 'cover',
        position: 'center',
      })
      .toFormat(validated.format as keyof sharp.FormatEnum)
      .toBuffer();
  } catch {
    throw new AppError('خطا در ساخت تصویر بندانگشتی.', httpStatus.BAD_REQUEST);
  }

  await ensureUploadDirs();

  const fileName = `${uuidv4()}${validated.ext}`;
  const filePath = path.join(UPLOAD_ROOT, fileName);
  const thumbPath = path.join(THUMB_ROOT, fileName);

  await fs.writeFile(filePath, validated.buffer);
  await fs.writeFile(thumbPath, thumbBuffer);

  const baseUrl = env.NODE_ENV !== 'test' && env.MEDIA_PUBLIC_BASE_URL
    ? env.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, '')
    : '';

  return {
    url: `${baseUrl}/uploads/${fileName}`,
    thumbUrl: `${baseUrl}/uploads/${THUMB_DIR_NAME}/${fileName}`,
    fileName: fileName,
  };
}

function resolveContainedPath(rootDir: string, rawUrl: string): string | null {
  const fileName = path.basename(rawUrl.split('?')[0].split('#')[0]);
  if (!fileName || fileName === '.' || fileName === '..' || fileName.includes('\0')) {
    return null;
  }
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(resolvedRoot, fileName);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolvedTarget;
}

/**
 * Deletes a file and its thumbnail from disk.
 */
export async function deleteStoredImage(url: string, thumbUrl?: string | null) {
  try {
    const filePath = resolveContainedPath(UPLOAD_ROOT, url);
    if (filePath) {
      await fs.unlink(filePath);
    }

    if (thumbUrl) {
      const thumbPath = resolveContainedPath(THUMB_ROOT, thumbUrl);
      if (thumbPath) {
        await fs.unlink(thumbPath);
      }
    }
  } catch (error) {
    // Log error but don't fail (best effort)
    console.error('Failed to delete image files:', error);
  }
}
