import { z } from 'zod';
import { WithdrawalRequestStatus, WalletTransactionType } from '@prisma/client';

export const requestWithdrawalSchema = z.object({
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

export const listCustomerWithdrawalsSchema = z.object({
  query: z.object({
    page: z.preprocess((val) => Number(val), z.number().int().min(1)).optional(),
    pageSize: z.preprocess((val) => Number(val), z.number().int().min(1).max(100)).optional(),
    status: z.nativeEnum(WithdrawalRequestStatus).optional(),
  }),
});

export const customerWithdrawalIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Withdrawal ID is required'),
  }),
});

export const listCustomerTransactionsSchema = z.object({
  query: z.object({
    page: z.preprocess((val) => Number(val), z.number().int().min(1)).optional(),
    pageSize: z.preprocess((val) => Number(val), z.number().int().min(1).max(100)).optional(),
    type: z.nativeEnum(WalletTransactionType).optional(),
  }),
});

export const customerTransactionIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Transaction ID is required'),
  }),
});

export const listCustomerNotificationsSchema = z.object({
  query: z.object({
    page: z.preprocess((val) => Number(val), z.number().int().min(1)).optional(),
    pageSize: z.preprocess((val) => Number(val), z.number().int().min(1).max(100)).optional(),
  }),
});

export const customerNotificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Notification ID is required'),
  }),
});
