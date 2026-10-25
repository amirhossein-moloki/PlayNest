import { z } from 'zod';
import { ReservationStatus } from '@prisma/client';

const CUID_MESSAGE = 'Invalid CUID';

export const getCalendarQuerySchema = z.object({
  params: z.object({
    gamingCenterId: z.string().cuid(CUID_MESSAGE),
  }),
  query: z
    .object({
      dateFrom: z.string().min(1, 'dateFrom is required'),
      dateTo: z.string().min(1, 'dateTo is required'),
      status: z
        .union([
          z.nativeEnum(ReservationStatus),
          z.array(z.nativeEnum(ReservationStatus)),
          z.string().transform((val) => val.split(',').map((s) => s.trim() as ReservationStatus)),
        ])
        .optional(),
      stationId: z.string().cuid(CUID_MESSAGE).optional(),
      staffId: z.string().cuid(CUID_MESSAGE).optional(),
      customerAccountId: z.string().cuid(CUID_MESSAGE).optional(),
      page: z.preprocess((val) => (val ? Number(val) : 1), z.number().int().min(1)).optional().default(1),
      pageSize: z
        .preprocess((val) => (val ? Number(val) : 100), z.number().int().min(1).max(500))
        .optional()
        .default(100),
    })
    .refine(
      (data) => {
        const fromDate = new Date(data.dateFrom);
        const toDate = new Date(data.dateTo);
        return !isNaN(fromDate.getTime()) && !isNaN(toDate.getTime());
      },
      {
        message: 'dateFrom and dateTo must be valid date strings (YYYY-MM-DD or ISO 8601)',
        path: ['dateFrom'],
      }
    )
    .refine(
      (data) => {
        const fromDate = new Date(data.dateFrom);
        const toDate = new Date(data.dateTo);
        return toDate.getTime() >= fromDate.getTime();
      },
      {
        message: 'dateTo must be equal to or after dateFrom',
        path: ['dateTo'],
      }
    )
    .refine(
      (data) => {
        const fromDate = new Date(data.dateFrom);
        const toDate = new Date(data.dateTo);
        const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 31;
      },
      {
        message: 'Calendar date range cannot exceed 31 days',
        path: ['dateTo'],
      }
    ),
});

export type GetCalendarQueryInput = z.infer<typeof getCalendarQuerySchema>['query'];
