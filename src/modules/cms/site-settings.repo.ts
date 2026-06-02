import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export async function findSiteSettingsByGamingCenterId(gamingCenterId: string) {
  return prisma.siteSettings.findUnique({
    where: { gamingCenterId },
  });
}

export async function upsertSiteSettings(
  gamingCenterId: string,
  data: Prisma.SiteSettingsUncheckedUpdateInput
) {
  return prisma.siteSettings.upsert({
    where: { gamingCenterId },
    create: {
      gamingCenterId,
      ...(data as any), // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    update: data,
  });
}
