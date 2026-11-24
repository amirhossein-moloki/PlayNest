import { z } from 'zod';

/**
 * Safely parses optional boolean query/form parameters without JavaScript's Boolean("false") === true bug.
 */
export const parseOptionalBoolean = () =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const normalized = val.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
    }
    return val;
  }, z.boolean().optional());

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const baseFilterSchema = paginationSchema.merge(sortSchema).extend({
  search: z.string().optional(),
  isActive: parseOptionalBoolean(),
});

export type BaseFilterQuery = z.infer<typeof baseFilterSchema>;
