import { prisma } from '../../config/prisma';

export async function findPublicAddressesByGamingCenterId(gamingCenterId: string) {
  return prisma.address.findMany({
    where: {
      gamingCenterId,
    },
  });
}
