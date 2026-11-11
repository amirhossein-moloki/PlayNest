import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const updateSettingsSchema = z.object({
  body: z.object({
    timeZone: z.string().optional(),
    timezone: z.string().optional(),
    workStartTime: z.string().regex(timeRegex, 'Invalid workStartTime format (HH:mm)').optional(),
    workEndTime: z.string().regex(timeRegex, 'Invalid workEndTime format (HH:mm)').optional(),
    openingTime: z.string().regex(timeRegex, 'Invalid openingTime format (HH:mm)').optional(),
    closingTime: z.string().regex(timeRegex, 'Invalid closingTime format (HH:mm)').optional(),
    allowOnlineBooking: z.boolean().optional(),
    onlineBookingAutoConfirm: z.boolean().optional(),
    requireOtpForPublicBooking: z.boolean().optional(),
    preventOverlaps: z.boolean().optional(),
    maxAdvanceBookingDays: z.number().int().min(1).optional(),
    minAdvanceBookingMinutes: z.number().int().min(0).optional(),
    cancellationHours: z.number().int().min(0).optional(),
    cancellationWindowMinutes: z.number().int().min(0).optional(),
    depositRequirementPercentage: z.number().min(0).optional(),
    noShowPenaltyAmount: z.number().min(0).optional(),
    autoReleaseUnpaidMinutes: z.number().int().min(0).optional(),
    reservationConfirmationTimeoutMinutes: z.number().int().min(1).max(1440).optional(),
  }),
  params: z.object({
    gamingCenterId: z.string().min(1, 'gamingCenterId is required'),
  }),
});

export const getSettingsSchema = z.object({
  params: z.object({
    gamingCenterId: z.string().min(1, 'gamingCenterId is required'),
  }),
});
