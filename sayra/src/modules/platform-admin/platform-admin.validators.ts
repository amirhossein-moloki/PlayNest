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

export const updatePlatformGamingCenterSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters long').optional(),
    slug: z
      .string()
      .min(3, 'Slug must be at least 3 characters long')
      .regex(
        /^[a-z0-9-]+$/,
        'Slug can only contain lowercase letters, numbers, and hyphens',
      )
      .optional(),
    isActive: z.boolean().optional(),
    subscriptionStatus: z.string().optional(),
    games: z.array(z.string()).max(100, 'Games list cannot exceed 100 items').optional(),
    ownerId: z.string().optional(),
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

export const listPlatformReservationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  city: z.string().trim().optional(),
  gamingCenterId: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PAID',
    'CANCELLED',
    'CANCELED',
    'COMPLETED',
    'EXPIRED',
    'REJECTED',
    'IN_PROGRESS',
    'NO_SHOW',
  ]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['startTime', 'endTime', 'createdAt', 'totalPrice', 'status']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).transform((val) => val.toLowerCase() as 'asc' | 'desc').optional().default('desc'),
});
