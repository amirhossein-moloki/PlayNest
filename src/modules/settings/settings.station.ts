import { SessionActorType } from '@prisma/client';
import { auditService } from '../audit/audit.station';
import * as settingsRepo from './settings.repo';
import { UpdateSettingsInput } from './settings.types';

export async function getSettings(gamingCenterId: string) {
  const settings = await settingsRepo.findBySalonId(gamingCenterId);
  if (!settings) {
    // Should normally be created when gamingCenter is created, but handle if missing
    return {
      gamingCenterId,
      preventOverlaps: true,
      allowOnlineBooking: false,
      onlineBookingAutoConfirm: false
    };
  }
  return settings;
}

export async function updateSettings(
  gamingCenterId: string,
  input: UpdateSettingsInput,
  actor: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) {
  const oldSettings = await settingsRepo.findBySalonId(gamingCenterId);
  const updatedSettings = await settingsRepo.updateBySalonId(gamingCenterId, input);

  await auditService.log(
    gamingCenterId,
    actor,
    'SETTINGS_UPDATE',
    { name: 'Settings', id: updatedSettings.id },
    { old: oldSettings, new: updatedSettings },
    context
  );

  return updatedSettings;
}
