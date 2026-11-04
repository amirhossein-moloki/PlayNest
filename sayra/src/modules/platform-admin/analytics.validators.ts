import { z } from 'zod';

export const platformAnalyticsReportsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  city: z.string().optional(),
  gamingCenterId: z.string().optional(),
  compare: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((val) => val === 'true'),
  groupBy: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional().default('DAILY'),
});

export type PlatformAnalyticsReportsQuery = z.infer<typeof platformAnalyticsReportsQuerySchema>;
