import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';

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
 * Process an uploaded image: save the original and generate a thumbnail.
 * Returns the relative URLs for both.
 */
export async function processAndStoreImage(file: Express.Multer.File) {
  await ensureUploadDirs();

  let fileExtension = path.extname(file.originalname).toLowerCase();
  if (!fileExtension && file.mimetype) {
    if (file.mimetype.includes('jpeg') || file.mimetype.includes('jpg')) fileExtension = '.jpg';
    else if (file.mimetype.includes('png')) fileExtension = '.png';
    else if (file.mimetype.includes('webp')) fileExtension = '.webp';
    else if (file.mimetype.includes('gif')) fileExtension = '.gif';
    else if (file.mimetype.includes('avif')) fileExtension = '.avif';
  }
  if (!fileExtension) {
    fileExtension = '.jpg';
  }
  const fileName = `${uuidv4()}${fileExtension}`;

  const filePath = path.join(UPLOAD_ROOT, fileName);
  const thumbPath = path.join(THUMB_ROOT, fileName);

  // Save original file
  await fs.writeFile(filePath, file.buffer);

  // Generate thumbnail using sharp
  // We'll use a standard 300x300 cover crop for thumbnails
  await sharp(file.buffer)
    .resize(300, 300, {
      fit: 'cover',
      position: 'center',
    })
    .toFile(thumbPath);

  const baseUrl = env.NODE_ENV !== 'test' && env.MEDIA_PUBLIC_BASE_URL
    ? env.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, '')
    : '';

  return {
    url: `${baseUrl}/uploads/${fileName}`,
    thumbUrl: `${baseUrl}/uploads/${THUMB_DIR_NAME}/${fileName}`,
    fileName: fileName,
  };
}

/**
 * Deletes a file and its thumbnail from disk.
 */
export async function deleteStoredImage(url: string, thumbUrl?: string | null) {
  try {
    const fileName = path.basename(url.split('?')[0]);
    const filePath = path.join(UPLOAD_ROOT, fileName);
    await fs.unlink(filePath);

    if (thumbUrl) {
      const thumbFileName = path.basename(thumbUrl.split('?')[0]);
      const thumbPath = path.join(THUMB_ROOT, thumbFileName);
      await fs.unlink(thumbPath);
    }
  } catch (error) {
    // Log error but don't fail (best effort)
    console.error('Failed to delete image files:', error);
  }
}
