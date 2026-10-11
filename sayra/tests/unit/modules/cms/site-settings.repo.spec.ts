import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as SiteSettingsRepo from '../../../../src/modules/cms/site-settings.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('SiteSettingsRepo', () => {
  const gamingCenterId = 'gc-1';
  const settingsMock = prismaMock.siteSettings /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  it('findSiteSettingsByGamingCenterId', async () => {
    settingsMock.findUnique.mockResolvedValue({ id: 's-1' });
    await SiteSettingsRepo.findSiteSettingsByGamingCenterId(gamingCenterId);
    expect(settingsMock.findUnique).toHaveBeenCalled();
  });

  it('upsertSiteSettings', async () => {
    settingsMock.upsert.mockResolvedValue({ id: 's-1' });
    await SiteSettingsRepo.upsertSiteSettings(gamingCenterId, { logoUrl: 'logo' });
    expect(settingsMock.upsert).toHaveBeenCalled();
  });
});
