
import { z } from 'zod';
import { CommissionType, CommissionStatus, CommissionPaymentStatus, CommissionPaymentMethod } from '@prisma/client';

const CUID_MESSAGE = 'Invalid CUID';

export const upsertPolicySchema = z.object({
  body: z.object({
    type: z.nativeEnum(CommissionType),
    percentBps: z.number().int().min(0).max(10000).optional(),
    fixedAmount: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    monthlyTarget: z.number().int().min(0).nullable().optional(),
    maxPercentBps: z.number().int().min(0).max(10000).optional(),
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
    if (data.percentBps !== undefined && data.maxPercentBps !== undefined && data.percentBps > data.maxPercentBps) {
      return false;
    }
    return true;
  }, {
    message: 'Invalid policy configuration or missing required fields for commission type.',
  }),
});

export const getTargetProgressQuerySchema = z.object({
  query: z.object({
    targetPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'targetPeriod must be in YYYY-MM format').optional(),
  }),
});

export const listEarningsQuerySchema = z.object({
  query: z.object({
    page: z.preprocess((val) => Number(val), z.number().int().min(1)).optional(),
    pageSize: z.preprocess((val) => Number(val), z.number().int().min(1).max(100)).optional(),
    status: z.nativeEnum(CommissionStatus).optional(),
    targetPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(),
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
export type ListCommissionsQuery = z.infer<typeof listEarningsQuerySchema>['query'];
export type RecordCommissionPaymentInput = z.infer<typeof recordCommissionPaymentSchema>['body'];
