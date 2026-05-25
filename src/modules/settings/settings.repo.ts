import { prisma } from '../../config/prisma';
import { UpdateSettingsInput } from './settings.types';

export async function findBySalonId(gamingCenterId: string) {
  return prisma.settings.findUnique({
    where: { gamingCenterId },
  });
}

export async function updateBySalonId(gamingCenterId: string, data: UpdateSettingsInput) {
  return prisma.settings.upsert({
    where: { gamingCenterId },
    update: data,
    create: {
      gamingCenterId,
      ...data,
    },
  });
}
