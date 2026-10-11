import { env } from '../../../config/env';
import { StorageAdapter, StorageUploadInput, StorageUploadResult } from './storage.types';

const toPublicUrl = (key: string) => {
  if (env.MEDIA_PUBLIC_BASE_URL) {
    return `${env.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  }

  const region = env.MEDIA_S3_REGION ?? 'us-east-1';
  return `https://${env.MEDIA_S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
};

const buildUploadUrl = (key: string) => {
  const template = env.MEDIA_S3_UPLOAD_URL_TEMPLATE;
  if (!template) {
    throw new Error('MEDIA_S3_UPLOAD_URL_TEMPLATE is required for S3 uploads');
  }

  return template.replace('{key}', key);
};

export class S3StorageAdapter implements StorageAdapter {
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    if (!env.MEDIA_S3_BUCKET || !env.MEDIA_S3_REGION) {
      throw new Error('S3 storage requires MEDIA_S3_BUCKET and MEDIA_S3_REGION');
    }

    const uploadUrl = buildUploadUrl(input.key);
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: input.body as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      headers: {
        'Content-Type': input.contentType ?? 'application/octet-stream',
        ...(input.cacheControl ? { 'Cache-Control': input.cacheControl } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to upload media to S3: ${response.status} ${response.statusText}`);
    }

    return { key: input.key, url: toPublicUrl(input.key) };
  }
}
