import { prisma } from '../../config/prisma';
import { UpdateSettingsInput } from './settings.types';

export async function findByGamingCenterId(gamingCenterId: string) {
  return prisma.settings.findUnique({
    where: { gamingCenterId },
  });
}

export async function updateByGamingCenterId(gamingCenterId: string, data: UpdateSettingsInput) {
  return prisma.settings.upsert({
    where: { gamingCenterId },
    update: data,
    create: {
      gamingCenterId,
      ...data,
    },
  });
}
