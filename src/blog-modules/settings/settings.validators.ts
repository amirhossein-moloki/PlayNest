import { z } from 'zod';

export const updateSettingsSchema = z.object({
  body: z.object({
    timeZone: z.string().optional(),
    workStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    workEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    allowOnlineBooking: z.boolean().optional(),
    onlineBookingAutoConfirm: z.boolean().optional(),
    requireOtpForPublicBooking: z.boolean().optional(),
    preventOverlaps: z.boolean().optional(),
  }),
  params: z.object({
    gamingCenterId: z.string().cuid(),
  }),
});

export const getSettingsSchema = z.object({
  params: z.object({
    gamingCenterId: z.string().cuid(),
  }),
});
