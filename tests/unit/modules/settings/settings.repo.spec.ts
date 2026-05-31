import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as SettingsRepo from '../../../../src/modules/settings/settings.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('SettingsRepo', () => {
  const settingsMock = prismaMock.settings as any;

  it('findBySalonId', async () => {
    settingsMock.findUnique.mockResolvedValue({ id: 's-1' });
    await SettingsRepo.findBySalonId('gc-1');
    expect(settingsMock.findUnique).toHaveBeenCalled();
  });

  it('updateBySalonId', async () => {
    settingsMock.upsert.mockResolvedValue({ id: 's-1' });
    await SettingsRepo.updateBySalonId('gc-1', { timeZone: 'UTC' });
    expect(settingsMock.upsert).toHaveBeenCalled();
  });
});
