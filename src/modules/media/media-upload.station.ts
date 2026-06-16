import path from 'node:path';
import { MediaType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { getStorageAdapter } from './storage';

const DEFAULT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface UploadMediaInput {
  gamingCenterId: string;
  type: MediaType;
  contentType?: string;
  originalName?: string;
  buffer: Buffer;
}

export interface UploadMediaResult {
  url: string;
  thumbUrl?: string;
  storageKey: string;
  thumbStorageKey?: string;
}

const normalizeExtension = (contentType?: string, originalName?: string) => {
  if (originalName) {
    const ext = path.extname(originalName).toLowerCase();
    if (ext) return ext;
  }

  if (contentType?.includes('jpeg')) return '.jpg';
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('gif')) return '.gif';

  return '';
};

const buildStorageKey = (id: string, scope: 'gamingCenters' | 'tickets', variant: 'original' | 'thumb', extension: string) => {
  const fileId = uuidv4();
  return `${scope}/${id}/media/${variant}/${fileId}${extension}`;
};

export async function uploadMedia(input: UploadMediaInput): Promise<UploadMediaResult> {
  const adapter = getStorageAdapter();
  const extension = normalizeExtension(input.contentType, input.originalName);

  const originalKey = buildStorageKey(input.gamingCenterId, 'gamingCenters', 'original', extension);
  const originalUpload = await adapter.upload({
    key: originalKey,
    body: input.buffer,
    contentType: input.contentType,
    cacheControl: DEFAULT_CACHE_CONTROL,
  });

  if (input.type !== MediaType.IMAGE) {
    return {
      url: originalUpload.url,
      storageKey: originalUpload.key,
    };
  }

  const thumbKey = buildStorageKey(input.gamingCenterId, 'gamingCenters', 'thumb', extension);
  const thumbUpload = await adapter.upload({
    key: thumbKey,
    body: input.buffer,
    contentType: input.contentType,
    cacheControl: DEFAULT_CACHE_CONTROL,
  });

  return {
    url: originalUpload.url,
    thumbUrl: thumbUpload.url,
    storageKey: originalUpload.key,
    thumbStorageKey: thumbUpload.key,
  };
}

export interface UploadTicketAttachmentInput {
  ticketId: string;
  contentType?: string;
  originalName?: string;
  buffer: Buffer;
}

export async function uploadTicketAttachment(input: UploadTicketAttachmentInput): Promise<string> {
  const adapter = getStorageAdapter();
  const extension = normalizeExtension(input.contentType, input.originalName);

  const key = buildStorageKey(input.ticketId, 'tickets', 'original', extension);
  const upload = await adapter.upload({
    key,
    body: input.buffer,
    contentType: input.contentType,
    cacheControl: DEFAULT_CACHE_CONTROL,
  });

  return upload.url;
}
