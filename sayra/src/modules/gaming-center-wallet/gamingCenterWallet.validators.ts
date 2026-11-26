import { z } from 'zod';
import { GamingCenterWalletTransactionType, WithdrawalRequestStatus } from '@prisma/client';

const optionalPositivePage = z.preprocess(
  (val) => (val === undefined || val === '' ? undefined : Number(val)),
  z.number().int().min(1).optional()
);

const optionalPageSize = z.preprocess(
  (val) => (val === undefined || val === '' ? undefined : Number(val)),
  z.number().int().min(1).max(100).optional()
);

export const requestGamingCenterWithdrawalSchema = z.object({
  body: z.object({
    amount: z.number().int().positive('Amount must be a positive integer'),
    bankDetails: z
      .object({
        sheba: z.string().min(10).max(34).optional(),
        cardNumber: z.string().min(16).max(19).optional(),
        accountHolderName: z.string().min(2).max(100).optional(),
        bankName: z.string().min(2).max(50).optional(),
      })
      .passthrough()
      .optional(),
    note: z.string().max(500).optional(),
  }),
});

export const listGamingCenterWithdrawalsSchema = z.object({
  query: z.object({
    page: optionalPositivePage,
    pageSize: optionalPageSize,
    status: z.nativeEnum(WithdrawalRequestStatus).optional(),
  }),
});

export const gamingCenterWithdrawalIdParamSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Withdrawal ID is required'),
  }),
});

export const listGamingCenterTransactionsSchema = z.object({
  query: z.object({
    page: optionalPositivePage,
    pageSize: optionalPageSize,
    type: z.nativeEnum(GamingCenterWalletTransactionType).optional(),
  }),
});

export const gamingCenterTransactionIdParamSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Transaction ID is required'),
  }),
});

export const listPlatformGamingCenterWithdrawalsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.nativeEnum(WithdrawalRequestStatus).optional(),
    gamingCenterId: z.string().optional(),
    search: z.string().optional(),
    startDate: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
    endDate: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
    sortBy: z.enum(['createdAt', 'amount', 'approvedAt', 'paidAt']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const getPlatformGamingCenterWithdrawalDetailsSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Withdrawal ID is required'),
  }),
});

export const approvePlatformGamingCenterWithdrawalSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Withdrawal ID is required'),
  }),
  body: z.object({
    note: z.string().max(500).optional(),
  }),
});

export const rejectPlatformGamingCenterWithdrawalSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Withdrawal ID is required'),
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Rejection reason must be at least 3 characters').max(500),
    note: z.string().max(500).optional(),
  }),
});

export const updatePlatformGamingCenterWithdrawalPaymentSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Withdrawal ID is required'),
  }),
  body: z.object({
    status: z.enum(['PROCESSING', 'PAID', 'FAILED']),
    paymentReference: z.string().max(100).optional(),
    note: z.string().max(500).optional(),
  }),
});
