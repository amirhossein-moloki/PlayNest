import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { MediaPurpose, MediaType } from '@prisma/client';
import * as MediaRepo from './media.repo';
import { CreateMediaInput, UpdateMediaInput } from './media.types';

const ALT_TEXT_REQUIRED_PURPOSES = new Set<MediaPurpose>([
  MediaPurpose.LOGO,
  MediaPurpose.COVER,
]);

const assertAltTextForPurpose = (
  purpose: MediaPurpose,
  altText: string | null | undefined
) => {
  if (ALT_TEXT_REQUIRED_PURPOSES.has(purpose) && !altText) {
    throw new AppError('Alt text is required for logo or cover media.', httpStatus.BAD_REQUEST);
  }
};

export async function createMedia(gamingCenterId: string, data: CreateMediaInput) {
  const purpose = data.purpose ?? MediaPurpose.GALLERY;
  const type = data.type ?? MediaType.IMAGE;

  assertAltTextForPurpose(purpose, data.altText);

  return MediaRepo.createMedia(gamingCenterId, {
    ...data,
    purpose,
    type,
  });
}

export async function updateMedia(
  gamingCenterId: string,
  mediaId: string,
  data: UpdateMediaInput
) {
  const existing = await MediaRepo.findMediaById(gamingCenterId, mediaId);
  if (!existing) {
    throw new AppError('Media not found', httpStatus.NOT_FOUND);
  }

  const nextPurpose = data.purpose ?? existing.purpose;
  const nextAltText = Object.prototype.hasOwnProperty.call(data, 'altText')
    ? data.altText
    : existing.altText;

  assertAltTextForPurpose(nextPurpose, nextAltText);

  return MediaRepo.updateMedia(mediaId, data);
}
