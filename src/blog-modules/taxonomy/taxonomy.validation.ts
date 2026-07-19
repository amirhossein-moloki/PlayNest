import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, 'Invalid slug format'),
  parentId: z.string().cuid().optional(),
  description: z.string().optional(),
  order: z.number().int().default(0),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, 'Invalid slug format'),
  description: z.string().optional(),
});

export const updateTagSchema = createTagSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listTaxonomySchema = z.object({
  page: z.preprocess((val) => Number(val), z.number().min(1).default(1)),
  limit: z.preprocess((val) => Number(val), z.number().min(1).max(100).default(10)),
  search: z.string().optional(),
  isActive: z.preprocess((val) => val === 'true', z.boolean()).optional(),
});

export type ListTaxonomyQuery = z.infer<typeof listTaxonomySchema>;
