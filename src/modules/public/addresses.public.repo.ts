import { prisma } from '../../config/prisma';

export async function findPublicAddressesBySalonId(gamingCenterId: string) {
  return prisma.address.findMany({
    where: {
      gamingCenterId,
    },
  });
}
