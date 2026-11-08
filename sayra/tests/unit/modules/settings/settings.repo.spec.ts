import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as SettingsRepo from '../../../../src/modules/settings/settings.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('SettingsRepo', () => {
  const settingsMock = prismaMock.settings as any;
  const gamingCenterMock = prismaMock.gamingCenter as any;

  it('findByGamingCenterId', async () => {
    settingsMock.findUnique.mockResolvedValue({ id: 's-1' });
    const result = await SettingsRepo.findByGamingCenterId('gc-1');
    expect(settingsMock.findUnique).toHaveBeenCalledWith({
      where: { gamingCenterId: 'gc-1' },
    });
    expect(result).toEqual({ id: 's-1' });
  });

  it('updateByGamingCenterId updates settings and synchronizes gaming center operating hours', async () => {
    settingsMock.upsert.mockResolvedValue({
      id: 's-1',
      gamingCenterId: 'gc-1',
      allowOnlineBooking: true,
      onlineBookingAutoConfirm: true,
      preventOverlaps: true,
      workStartTime: '09:00',
      workEndTime: '23:00',
      timeZone: 'Asia/Tehran',
    });
    gamingCenterMock.update.mockResolvedValue({ id: 'gc-1' });

    const updated = await SettingsRepo.updateByGamingCenterId('gc-1', {
      allowOnlineBooking: true,
      onlineBookingAutoConfirm: true,
      preventOverlaps: true,
      workStartTime: '09:00',
      workEndTime: '23:00',
      timeZone: 'Asia/Tehran',
    });

    expect(settingsMock.upsert).toHaveBeenCalledWith({
      where: { gamingCenterId: 'gc-1' },
      update: expect.objectContaining({
        allowOnlineBooking: true,
        onlineBookingAutoConfirm: true,
        preventOverlaps: true,
        workStartTime: '09:00',
        workEndTime: '23:00',
        timeZone: 'Asia/Tehran',
      }),
      create: expect.objectContaining({
        gamingCenterId: 'gc-1',
        allowOnlineBooking: true,
        onlineBookingAutoConfirm: true,
        preventOverlaps: true,
        workStartTime: '09:00',
        workEndTime: '23:00',
        timeZone: 'Asia/Tehran',
      }),
    });
    expect(gamingCenterMock.update).toHaveBeenCalledWith({
      where: { id: 'gc-1' },
      data: {
        openingTime: '09:00',
        closingTime: '23:00',
        timezone: 'Asia/Tehran',
      },
    });
    expect(updated).toBeDefined();
  });

  it('updateByGamingCenterId handles openingTime and closingTime alias fields', async () => {
    settingsMock.upsert.mockResolvedValue({ id: 's-2' });
    gamingCenterMock.update.mockResolvedValue({ id: 'gc-2' });

    await SettingsRepo.updateByGamingCenterId('gc-2', {
      openingTime: '10:00',
      closingTime: '22:00',
      timezone: 'UTC',
    });

    expect(settingsMock.upsert).toHaveBeenCalledWith({
      where: { gamingCenterId: 'gc-2' },
      update: expect.objectContaining({
        workStartTime: '10:00',
        workEndTime: '22:00',
        timeZone: 'UTC',
      }),
      create: expect.objectContaining({
        gamingCenterId: 'gc-2',
        workStartTime: '10:00',
        workEndTime: '22:00',
        timeZone: 'UTC',
      }),
    });
  });
});
