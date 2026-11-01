import { z } from 'zod';

export const listPlatformUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  gamingCenterId: z.string().optional(),
  role: z.string().optional(),
  search: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export const updatePlatformUserStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const resetUserPasswordSchema = z.object({
  body: z.object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters long'),
  }),
});

export const updateGamingCenterStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean().optional(),
    subscriptionStatus: z.string().optional(),
  }),
});

export const listPlatformAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  gamingCenterId: z.string().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const listPlatformCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
});
