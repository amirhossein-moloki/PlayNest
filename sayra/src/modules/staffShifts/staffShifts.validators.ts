import { z } from 'zod';

// Validation for a single staffShift
const shiftSchema = z.object({
  dayOfWeek: z.number().min(0).max(6), // 0 = Sunday, 6 = Saturday
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid start time format, expected HH:MM'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid end time format, expected HH:MM'),
  isActive: z.boolean(),
});

// Validation for the array of staffShifts in the request body
export const upsertShiftsSchema = z.object({
  body: z.array(shiftSchema).nonempty('Shifts array cannot be empty.'),
});

export type UpsertShiftsInput = z.infer<typeof upsertShiftsSchema>['body'];
