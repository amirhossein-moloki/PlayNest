
import { z } from 'zod';
import { subDays } from 'date-fns';

export const AnalyticsQuerySchema = z.object({
  query: z.object({
    startDate: z.coerce.date().default(() => subDays(new Date(), 30)),
    endDate: z.coerce.date().default(() => new Date()),
  }),
});

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>['query'];
