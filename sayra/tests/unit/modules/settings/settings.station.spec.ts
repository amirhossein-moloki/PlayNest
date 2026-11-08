import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as settingsStation from '../../../../src/modules/settings/settings.station';
import * as settingsRepo from '../../../../src/modules/settings/settings.repo';
import { auditService } from '../../../../src/modules/audit/audit.station';
import { SessionActorType } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../../src/modules/settings/settings.repo');
jest.mock('../../../../src/modules/audit/audit.station', () => ({
  auditService: {
    log: jest.fn().mockImplementation(() => Promise.resolve()),
  },
}));

describe('Settings Station', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return found settings from repo', async () => {
      const mockSettings = {
        id: 's-1',
        gamingCenterId: 'gc-1',
        allowOnlineBooking: true,
        onlineBookingAutoConfirm: false,
        preventOverlaps: true,
        workStartTime: '09:00',
        workEndTime: '23:00',
        timeZone: 'Asia/Tehran',
      };
      (settingsRepo.findByGamingCenterId as jest.MockedFunction<any>).mockResolvedValue(mockSettings);

      const result = await settingsStation.getSettings('gc-1');
      expect(result).toEqual(mockSettings);
      expect(settingsRepo.findByGamingCenterId).toHaveBeenCalledWith('gc-1');
    });

    it('should return default fallback settings when none exist', async () => {
      (settingsRepo.findByGamingCenterId as jest.MockedFunction<any>).mockResolvedValue(null);

      const result = await settingsStation.getSettings('gc-fallback');
      expect(result).toEqual({
        gamingCenterId: 'gc-fallback',
        preventOverlaps: true,
        allowOnlineBooking: false,
        onlineBookingAutoConfirm: false,
        requireOtpForPublicBooking: false,
        timeZone: 'Asia/Tehran',
        workStartTime: '09:00',
        workEndTime: '23:00',
        maxAdvanceBookingDays: 7,
        minAdvanceBookingMinutes: 30,
        cancellationHours: 2,
        noShowPenaltyAmount: 0,
        autoReleaseUnpaidMinutes: 15,
      });
    });
  });

  describe('updateSettings', () => {
    it('should update settings, record audit log, and return updated settings', async () => {
      const oldSettings = {
        id: 's-1',
        gamingCenterId: 'gc-1',
        allowOnlineBooking: false,
        preventOverlaps: true,
      };
      const updatedSettings = {
        id: 's-1',
        gamingCenterId: 'gc-1',
        allowOnlineBooking: true,
        onlineBookingAutoConfirm: true,
        preventOverlaps: true,
        workStartTime: '08:00',
        workEndTime: '22:00',
      };

      (settingsRepo.findByGamingCenterId as jest.MockedFunction<any>).mockResolvedValue(oldSettings);
      (settingsRepo.updateByGamingCenterId as jest.MockedFunction<any>).mockResolvedValue(updatedSettings);

      const actor = { id: 'mgr-1', actorType: SessionActorType.USER };
      const context = { ip: '127.0.0.1', userAgent: 'Jest' };
      const input = {
        allowOnlineBooking: true,
        onlineBookingAutoConfirm: true,
        workStartTime: '08:00',
        workEndTime: '22:00',
      };

      const result = await settingsStation.updateSettings('gc-1', input, actor, context);

      expect(settingsRepo.findByGamingCenterId).toHaveBeenCalledWith('gc-1');
      expect(settingsRepo.updateByGamingCenterId).toHaveBeenCalledWith('gc-1', input);
      expect(auditService.log).toHaveBeenCalledWith(
        'gc-1',
        actor,
        'SETTINGS_UPDATE',
        { name: 'Settings', id: 's-1' },
        { old: oldSettings, new: updatedSettings },
        context
      );
      expect(result).toEqual(updatedSettings);
    });
  });
});
