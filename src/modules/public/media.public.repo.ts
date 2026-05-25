import { prisma } from '../../config/prisma';

export async function findPublicMediaBySalonId(gamingCenterId: string) {
  return prisma.media.findMany({
    where: {
      gamingCenterId,
      isActive: true,
    },
    orderBy: {
      sortOrder: 'asc',
    },
  });
}
