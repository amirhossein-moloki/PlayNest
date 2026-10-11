import { prisma } from '../../config/prisma';
import { CreateMediaData, UpdateMediaData } from './media.types';

export async function createMedia(gamingCenterId: string, data: CreateMediaData) {
  return prisma.media.create({
    data: {
      ...(data as any), // eslint-disable-line @typescript-eslint/no-explicit-any
      gamingCenterId,
    },
  });
}

export async function findMediaById(gamingCenterId: string, mediaId: string) {
  return prisma.media.findFirst({
    where: {
      id: mediaId,
      gamingCenterId,
    },
  });
}

export async function updateMedia(gamingCenterId: string, mediaId: string, data: UpdateMediaData) {
  const result = await prisma.media.updateMany({
    where: { id: mediaId, gamingCenterId },
    data,
  });

  if (result.count === 0) return null;

  return prisma.media.findUnique({
    where: { id: mediaId },
  });
}
