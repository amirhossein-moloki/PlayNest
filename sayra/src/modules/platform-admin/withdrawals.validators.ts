import { z } from 'zod';
import { WithdrawalRequestStatus } from '@prisma/client';

export const listPlatformWithdrawalsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.nativeEnum(WithdrawalRequestStatus).optional(),
    customerAccountId: z.string().optional(),
    search: z.string().optional(),
    startDate: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
    endDate: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
    sortBy: z.enum(['createdAt', 'amount', 'approvedAt', 'paidAt']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const getPlatformWithdrawalDetailsSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Withdrawal ID is required'),
  }),
});

export const approvePlatformWithdrawalSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Withdrawal ID is required'),
  }),
  body: z.object({
    note: z.string().max(500).optional(),
  }),
});

export const rejectPlatformWithdrawalSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Withdrawal ID is required'),
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Rejection reason must be at least 3 characters').max(500),
    note: z.string().max(500).optional(),
  }),
});

export const updatePlatformWithdrawalPaymentSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Withdrawal ID is required'),
  }),
  body: z.object({
    status: z.enum(['PROCESSING', 'PAID', 'FAILED']),
    paymentReference: z.string().max(100).optional(),
    note: z.string().max(500).optional(),
  }),
});
