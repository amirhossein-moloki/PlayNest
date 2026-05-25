import { z } from 'zod';
import { baseFilterSchema } from '../../common/validators/query.validators';

export const createSalonSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters long')
    .regex(
      /^[a-z0-9-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens',
    ),
  ownerId: z.string().min(1, 'Owner ID is required'),
});

export const updateSalonSchema = z.object({
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
});

export const listSalonsSchema = baseFilterSchema.extend({
  city: z.string().optional(),
});

export type ListSalonsQuery = z.infer<typeof listSalonsSchema>;
