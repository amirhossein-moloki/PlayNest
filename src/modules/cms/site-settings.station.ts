import { Prisma } from '@prisma/client';
import * as SiteSettingsRepo from './site-settings.repo';
import { UpdateSiteSettingsInput } from './site-settings.validators';

const sanitizeUpdateData = (
  data: UpdateSiteSettingsInput
): Prisma.SalonSiteSettingsUncheckedUpdateInput => ({
  logoUrl: data.logoUrl,
  faviconUrl: data.faviconUrl,
  defaultSeoTitle: data.defaultSeoTitle,
  defaultSeoDescription: data.defaultSeoDescription,
  defaultOgImageUrl: data.defaultOgImageUrl,
  googleSiteVerification: data.googleSiteVerification,
  analyticsTag: data.analyticsTag,
  robotsIndex: data.robotsIndex,
  robotsFollow: data.robotsFollow,
});

export async function getSiteSettings(gamingCenterId: string) {
  return SiteSettingsRepo.findSiteSettingsBySalonId(gamingCenterId);
}

export async function upsertSiteSettings(
  gamingCenterId: string,
  data: UpdateSiteSettingsInput
) {
  const sanitized = sanitizeUpdateData(data);

  return SiteSettingsRepo.upsertSiteSettings(gamingCenterId, sanitized);
}
