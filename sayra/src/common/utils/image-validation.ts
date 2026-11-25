import sharp from 'sharp';
import httpStatus from 'http-status';
import AppError from '../errors/AppError';

export const ALLOWED_RASTER_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export const ALLOWED_KYC_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const ALL_RASTER_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif']);
export const KYC_RASTER_FORMATS = new Set(['jpeg', 'png', 'webp']);

const FORMAT_METADATA: Record<string, { ext: string; mime: string }> = {
  jpeg: { ext: '.jpg', mime: 'image/jpeg' },
  png: { ext: '.png', mime: 'image/png' },
  webp: { ext: '.webp', mime: 'image/webp' },
  gif: { ext: '.gif', mime: 'image/gif' },
  avif: { ext: '.avif', mime: 'image/avif' },
};

export function isLocalUploadPath(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const cleaned = rawUrl.trim().split('?')[0].split('#')[0];
  if (!cleaned) return false;
  if (cleaned.startsWith('/uploads/') || cleaned.startsWith('uploads/') || cleaned.includes('..')) {
    return true;
  }
  try {
    const parsed = new URL(cleaned);
    return parsed.pathname.startsWith('/uploads/');
  } catch {
    return false;
  }
}

export async function validateAndReencodeRasterImage(
  buffer: Buffer,
  options?: { allowedFormats?: ReadonlySet<string> }
): Promise<{ buffer: Buffer; format: string; ext: string; mime: string }> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError('فایل تصویر خالی یا نامعتبر است.', httpStatus.BAD_REQUEST);
  }

  const allowedFormats = options?.allowedFormats ?? ALL_RASTER_FORMATS;
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer, { failOnError: true }).metadata();
  } catch {
    throw new AppError('فایل آپلود شده یک تصویر معتبر نیست.', httpStatus.BAD_REQUEST);
  }

  const format = metadata.format?.toLowerCase();
  if (!format || !allowedFormats.has(format) || !FORMAT_METADATA[format]) {
    throw new AppError('فرمت تصویر پشتیبانی نمی‌شود.', httpStatus.BAD_REQUEST);
  }

  try {
    const reencoded = await sharp(buffer, { failOnError: true })
      .rotate()
      .toFormat(format as keyof sharp.FormatEnum)
      .toBuffer();

    return {
      buffer: reencoded,
      format,
      ext: FORMAT_METADATA[format].ext,
      mime: FORMAT_METADATA[format].mime,
    };
  } catch {
    throw new AppError('خطا در پردازش فایل تصویر.', httpStatus.BAD_REQUEST);
  }
}
