import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const scheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex, 'startTime must be in HH:mm format').nullable().optional(),
  endTime: z.string().regex(timeRegex, 'endTime must be in HH:mm format').nullable().optional(),
  isClosed: z.boolean().default(false),
}).refine(
  (data) => {
    if (data.isClosed) return true;
    return !!data.startTime && !!data.endTime;
  },
  {
    message: 'startTime and endTime are required when day is not marked as closed',
    path: ['startTime'],
  }
);

export const updateSchedulesSchema = z.object({
  body: z.object({
    schedules: z.array(scheduleItemSchema).min(1).max(7),
  }),
  params: z.object({
    gamingCenterId: z.string().min(1, 'gamingCenterId is required'),
  }),
});

export const getSchedulesSchema = z.object({
  params: z.object({
    gamingCenterId: z.string().min(1, 'gamingCenterId is required'),
  }),
});

export type ScheduleItem = z.infer<typeof scheduleItemSchema>;
export type UpdateSchedulesInput = z.infer<typeof updateSchedulesSchema>['body'];
