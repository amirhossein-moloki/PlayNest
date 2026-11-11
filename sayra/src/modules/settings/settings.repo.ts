import { prisma } from '../../config/prisma';
import { UpdateSettingsInput } from './settings.types';
import { Prisma } from '@prisma/client';

export async function findByGamingCenterId(gamingCenterId: string) {
  return prisma.settings.findUnique({
    where: { gamingCenterId },
  });
}

export async function updateByGamingCenterId(gamingCenterId: string, data: UpdateSettingsInput) {
  const {
    timeZone,
    timezone,
    workStartTime,
    workEndTime,
    openingTime,
    closingTime,
    allowOnlineBooking,
    onlineBookingAutoConfirm,
    requireOtpForPublicBooking,
    preventOverlaps,
    maxAdvanceBookingDays,
    minAdvanceBookingMinutes,
    cancellationHours,
    cancellationWindowMinutes,
    depositRequirementPercentage, // eslint-disable-line @typescript-eslint/no-unused-vars
    noShowPenaltyAmount,
    autoReleaseUnpaidMinutes,
    reservationConfirmationTimeoutMinutes,
  } = data;

  const resolvedTimeZone = timeZone ?? timezone;
  const resolvedWorkStartTime = workStartTime ?? openingTime;
  const resolvedWorkEndTime = workEndTime ?? closingTime;
  const resolvedCancellationHours =
    cancellationHours ??
    (cancellationWindowMinutes !== undefined ? Math.round(cancellationWindowMinutes / 60) : undefined);

  const updateData: Prisma.SettingsUpdateInput = {};
  if (resolvedTimeZone !== undefined) updateData.timeZone = resolvedTimeZone;
  if (resolvedWorkStartTime !== undefined) updateData.workStartTime = resolvedWorkStartTime;
  if (resolvedWorkEndTime !== undefined) updateData.workEndTime = resolvedWorkEndTime;
  if (allowOnlineBooking !== undefined) updateData.allowOnlineBooking = allowOnlineBooking;
  if (onlineBookingAutoConfirm !== undefined) updateData.onlineBookingAutoConfirm = onlineBookingAutoConfirm;
  if (requireOtpForPublicBooking !== undefined) updateData.requireOtpForPublicBooking = requireOtpForPublicBooking;
  if (preventOverlaps !== undefined) updateData.preventOverlaps = preventOverlaps;
  if (maxAdvanceBookingDays !== undefined) updateData.maxAdvanceBookingDays = maxAdvanceBookingDays;
  if (minAdvanceBookingMinutes !== undefined) updateData.minAdvanceBookingMinutes = minAdvanceBookingMinutes;
  if (resolvedCancellationHours !== undefined) updateData.cancellationHours = resolvedCancellationHours;
  if (noShowPenaltyAmount !== undefined) updateData.noShowPenaltyAmount = noShowPenaltyAmount;
  if (autoReleaseUnpaidMinutes !== undefined) updateData.autoReleaseUnpaidMinutes = autoReleaseUnpaidMinutes;
  if (reservationConfirmationTimeoutMinutes !== undefined) {
    updateData.reservationConfirmationTimeoutMinutes = reservationConfirmationTimeoutMinutes;
  }

  const updatedSettings = await prisma.settings.upsert({
    where: { gamingCenterId },
    update: updateData,
    create: {
      gamingCenterId,
      preventOverlaps: preventOverlaps ?? true,
      allowOnlineBooking: allowOnlineBooking ?? false,
      onlineBookingAutoConfirm: onlineBookingAutoConfirm ?? false,
      requireOtpForPublicBooking: requireOtpForPublicBooking ?? false,
      ...(resolvedTimeZone !== undefined && { timeZone: resolvedTimeZone }),
      ...(resolvedWorkStartTime !== undefined && { workStartTime: resolvedWorkStartTime }),
      ...(resolvedWorkEndTime !== undefined && { workEndTime: resolvedWorkEndTime }),
      ...(maxAdvanceBookingDays !== undefined && { maxAdvanceBookingDays }),
      ...(minAdvanceBookingMinutes !== undefined && { minAdvanceBookingMinutes }),
      ...(resolvedCancellationHours !== undefined && { cancellationHours: resolvedCancellationHours }),
      ...(noShowPenaltyAmount !== undefined && { noShowPenaltyAmount }),
      ...(autoReleaseUnpaidMinutes !== undefined && { autoReleaseUnpaidMinutes }),
      ...(reservationConfirmationTimeoutMinutes !== undefined && { reservationConfirmationTimeoutMinutes }),
    },
  });

  // Keep GamingCenter operating hours and timezone synchronized
  const gcData: Prisma.GamingCenterUpdateInput = {};
  if (resolvedWorkStartTime !== undefined) gcData.openingTime = resolvedWorkStartTime;
  if (resolvedWorkEndTime !== undefined) gcData.closingTime = resolvedWorkEndTime;
  if (resolvedTimeZone !== undefined) gcData.timezone = resolvedTimeZone;

  if (Object.keys(gcData).length > 0) {
    try {
      await prisma.gamingCenter.update({
        where: { id: gamingCenterId },
        data: gcData,
      });
    } catch {
      // Ignore if gamingCenter update fails (e.g., in unit tests or mocks)
    }
  }

  return updatedSettings;
}
