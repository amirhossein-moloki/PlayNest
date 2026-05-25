
import { z } from 'zod';
import { CommissionType, CommissionStatus, CommissionPaymentStatus, CommissionPaymentMethod } from '@prisma/client';

const CUID_MESSAGE = 'Invalid CUID';

export const upsertPolicySchema = z.object({
  body: z.object({
    type: z.nativeEnum(CommissionType),
    percentBps: z.number().int().min(0).max(10000).optional(),
    fixedAmount: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    applyToOnlineOnly: z.boolean().optional(),
    minimumFeeAmount: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  }).refine((data) => {
    if (data.type === CommissionType.PERCENT && data.percentBps === undefined) {
      return false;
    }
    if (data.type === CommissionType.FIXED && (data.fixedAmount === undefined || data.currency === undefined)) {
      return false;
    }
    return true;
  }, {
    message: 'Missing required fields for the selected commission type.',
  }),
});

export const listCommissionsQuerySchema = z.object({
  query: z.object({
    page: z.preprocess((val) => Number(val), z.number().int().min(1)).optional(),
    pageSize: z.preprocess((val) => Number(val), z.number().int().min(1).max(100)).optional(),
    status: z.nativeEnum(CommissionStatus).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  }),
});

export const recordCommissionPaymentSchema = z.object({
  params: z.object({
    earningId: z.string().cuid(CUID_MESSAGE),
  }),
  body: z.object({
    amount: z.number().int().positive(),
    currency: z.string().length(3),
    status: z.nativeEnum(CommissionPaymentStatus).default(CommissionPaymentStatus.PAID),
    method: z.nativeEnum(CommissionPaymentMethod).optional(),
    referenceCode: z.string().optional(),
    paidAt: z.string().datetime().optional(),
  }),
});

export type UpsertPolicyInput = z.infer<typeof upsertPolicySchema>['body'];
export type ListCommissionsQuery = z.infer<typeof listCommissionsQuerySchema>['query'];
export type RecordCommissionPaymentInput = z.infer<typeof recordCommissionPaymentSchema>['body'];
