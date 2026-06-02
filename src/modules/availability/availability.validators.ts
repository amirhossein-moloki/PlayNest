import { z } from 'zod';

export const getAvailabilitySchema = z.object({
  params: z.object({
    gamingCenterSlug: z.string(),
  }),
  query: z.object({
    stationId: z.string().cuid({ message: 'Invalid station ID format' }),
    staffId: z.string().cuid({ message: 'Invalid staff ID format' }).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  }).refine(data => data.endDate > data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  }),
});

export type GetAvailabilityQuery = z.infer<typeof getAvailabilitySchema>['query'];
