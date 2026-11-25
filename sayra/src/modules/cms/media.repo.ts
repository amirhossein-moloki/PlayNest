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

export async function deleteMedia(gamingCenterId: string, mediaId: string) {
  return prisma.media.deleteMany({
    where: { id: mediaId, gamingCenterId },
  });
}

export async function countOtherMediaReferences(
  mediaId: string,
  url: string,
  thumbUrl?: string | null
): Promise<number> {
  let refs = 0;

  if (typeof prisma.media?.count === 'function') {
    const orFilters: Array<Record<string, string>> = [{ url }, { thumbUrl: url }];
    if (thumbUrl) {
      orFilters.push({ url: thumbUrl }, { thumbUrl });
    }
    refs += await prisma.media.count({
      where: {
        id: { not: mediaId },
        OR: orFilters,
      },
    });
  }

  if (typeof (prisma as any).gamingCenter?.count === 'function') {
    refs += await (prisma as any).gamingCenter.count({
      where: {
        OR: [{ logoUrl: url }, { coverUrl: url }],
      },
    });
  }

  return refs;
}
