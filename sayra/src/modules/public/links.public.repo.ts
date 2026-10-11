import { prisma } from '../../config/prisma';

export async function findPublicLinksByGamingCenterId(gamingCenterId: string) {
  return prisma.socialLink.findMany({
    where: {
      gamingCenterId,
      isActive: true,
    },
    select: {
      id: true,
      type: true,
      label: true,
      value: true,
      isPrimary: true,
    },
  });
}
