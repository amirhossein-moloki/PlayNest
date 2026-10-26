import { z } from 'zod';
import { subDays, differenceInDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { prisma } from '../../config/prisma';

export const AnalyticsQuerySchema = z.object({
  query: z
    .object({
      startDate: z.coerce.date().default(() => subDays(new Date(), 30)),
      endDate: z.coerce.date().default(() => new Date()),
      currency: z.string().optional(),
      granularity: z.enum(['day', 'week', 'month']).default('day'),
    })
    .refine((data) => data.startDate <= data.endDate, {
      message: 'startDate must be less than or equal to endDate',
      path: ['startDate'],
    })
    .refine((data) => Math.abs(differenceInDays(data.endDate, data.startDate)) <= 365, {
      message: 'Date range cannot exceed 365 days',
      path: ['endDate'],
    }),
});

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>['query'];

export const CustomerAnalyticsQuerySchema = z.object({
  query: z
    .object({
      startDate: z.coerce.date().default(() => subDays(new Date(), 30)),
      endDate: z.coerce.date().default(() => new Date()),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    })
    .refine((data) => data.startDate <= data.endDate, {
      message: 'startDate must be less than or equal to endDate',
      path: ['startDate'],
    })
    .refine((data) => Math.abs(differenceInDays(data.endDate, data.startDate)) <= 365, {
      message: 'Date range cannot exceed 365 days',
      path: ['endDate'],
    }),
});

export type CustomerAnalyticsQuery = z.infer<typeof CustomerAnalyticsQuerySchema>['query'];

export const FinancialReconciliationQuerySchema = z.object({
  query: z
    .object({
      startDate: z.coerce.date().default(() => subDays(new Date(), 30)),
      endDate: z.coerce.date().default(() => new Date()),
      ruleId: z.string().optional(),
      status: z.enum(['MATCHED', 'MISMATCH', 'MISSING_COUNTERPART', 'DUPLICATE_POSTING', 'PENDING_REVIEW', 'ALL']).default('ALL'),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    })
    .refine((data) => data.startDate <= data.endDate, {
      message: 'startDate must be less than or equal to endDate',
      path: ['startDate'],
    })
    .refine((data) => Math.abs(differenceInDays(data.endDate, data.startDate)) <= 365, {
      message: 'Date range cannot exceed 365 days',
      path: ['endDate'],
    }),
});

export type FinancialReconciliationQuery = z.infer<typeof FinancialReconciliationQuerySchema>['query'];

export const BenchmarkQuerySchema = z.object({
  query: z
    .object({
      startDate: z.coerce.date().default(() => subDays(new Date(), 30)),
      endDate: z.coerce.date().default(() => new Date()),
      peerGroupCategory: z.enum(['ALL', 'STANDARD', 'PREMIUM']).default('ALL'),
    })
    .refine((data) => data.startDate <= data.endDate, {
      message: 'startDate must be less than or equal to endDate',
      path: ['startDate'],
    })
    .refine((data) => Math.abs(differenceInDays(data.endDate, data.startDate)) <= 365, {
      message: 'Date range cannot exceed 365 days',
      path: ['endDate'],
    }),
});

export type BenchmarkQuery = z.infer<typeof BenchmarkQuerySchema>['query'];

export async function resolveTimezoneAndBoundaries(
  gamingCenterId: string,
  startDateInput: Date,
  endDateInput: Date
): Promise<{ timeZone: string; dayStart: Date; dayEnd: Date }> {
  const settings = await prisma.settings.findUnique({
    where: { gamingCenterId },
    select: { timeZone: true },
  });

  const timeZone = settings?.timeZone || 'UTC';

  const startStr = formatInTimeZone(startDateInput, timeZone, 'yyyy-MM-dd');
  const endStr = formatInTimeZone(endDateInput, timeZone, 'yyyy-MM-dd');

  const dayStart = fromZonedTime(`${startStr} 00:00:00`, timeZone);
  const dayEnd = fromZonedTime(`${endStr} 23:59:59.999`, timeZone);

  return {
    timeZone,
    dayStart,
    dayEnd,
  };
}
