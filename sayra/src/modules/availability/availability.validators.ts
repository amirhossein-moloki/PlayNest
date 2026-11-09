import { z } from 'zod';

export const getAvailabilitySchema = z.object({
  params: z.object({
    gamingCenterSlug: z.string().min(1, 'Gaming center slug is required'),
  }),
  query: z
    .object({
      stationId: z.string().cuid({ message: 'Invalid station ID format' }),
      staffId: z.string().cuid({ message: 'Invalid staff ID format' }).optional(),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be formatted as YYYY-MM-DD' })
        .optional(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    })
    .refine(
      (data) => {
        if (data.startDate && data.endDate) {
          return data.endDate > data.startDate;
        }
        return true;
      },
      {
        message: 'End date must be after start date',
        path: ['endDate'],
      }
    )
    .refine(
      (data) => Boolean(data.date || data.startDate),
      {
        message: 'Either date (YYYY-MM-DD) or startDate must be provided',
        path: ['date'],
      }
    ),
});

export type GetAvailabilityQuery = z.infer<typeof getAvailabilitySchema>['query'];
