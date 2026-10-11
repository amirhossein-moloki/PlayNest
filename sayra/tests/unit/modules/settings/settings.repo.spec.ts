import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as SettingsRepo from '../../../../src/modules/settings/settings.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('SettingsRepo', () => {
  const settingsMock = prismaMock.settings /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  it('findByGamingCenterId', async () => {
    settingsMock.findUnique.mockResolvedValue({ id: 's-1' });
    await SettingsRepo.findByGamingCenterId('gc-1');
    expect(settingsMock.findUnique).toHaveBeenCalled();
  });

  it('updateByGamingCenterId', async () => {
    settingsMock.upsert.mockResolvedValue({ id: 's-1' });
    await SettingsRepo.updateByGamingCenterId('gc-1', { timeZone: 'UTC' });
    expect(settingsMock.upsert).toHaveBeenCalled();
  });
});
