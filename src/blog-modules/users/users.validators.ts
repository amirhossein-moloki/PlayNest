import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { baseFilterSchema } from '../../common/validators/query.validators';

export const createUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(3, 'Full name must be at least 3 characters long'),
    phone: z.string().regex(/^09[0-9]{9}$/, 'Invalid Iranian phone number format'),
    role: z.nativeEnum(UserRole),
    isPublic: z.boolean().optional(),
    publicName: z.string().optional(),
    bio: z.string().optional(),
    avatarUrl: z.string().url().optional(),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(3, 'Full name must be at least 3 characters long').optional(),
    role: z.nativeEnum(UserRole).optional(),
    isActive: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    publicName: z.string().optional(),
    bio: z.string().optional(),
    avatarUrl: z.string().url().optional(),
  }),
  params: z.object({
    userId: z.string().cuid('Invalid user ID format'),
  })
});

export const listUsersSchema = baseFilterSchema.extend({
  role: z.nativeEnum(UserRole).optional(),
  isPublic: z.preprocess(
    (val) => (val === 'true' ? true : val === 'false' ? false : undefined),
    z.boolean().optional()
  ),
  stationId: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];
export type ListUsersQuery = z.infer<typeof listUsersSchema>;
