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

export const createPlatformUserSchema = z.object({
  body: z.object({
    gamingCenterId: z.string().min(1, 'gamingCenterId is required'),
    firstName: z.string().min(1, 'firstName is required'),
    lastName: z.string().min(1, 'lastName is required'),
    phone: z.string().min(10, 'Valid phone number is required'),
    email: z.string().email('Invalid email address').optional().nullable(),
    password: z.string().min(6, 'Password must be at least 6 characters long').optional(),
    role: z.enum(['MANAGER', 'ADMIN']).optional().default('MANAGER'),
    isActive: z.boolean().optional().default(true),
  }),
});

export type CreatePlatformUserInput = z.infer<typeof createPlatformUserSchema>['body'];

export const updatePlatformUserSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().min(10).optional(),
    email: z.string().email('Invalid email address').optional().nullable(),
    isActive: z.boolean().optional(),
    bio: z.string().optional().nullable(),
    publicName: z.string().optional().nullable(),
    isPublic: z.boolean().optional(),
  }),
});

export type UpdatePlatformUserInput = z.infer<typeof updatePlatformUserSchema>['body'];

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
