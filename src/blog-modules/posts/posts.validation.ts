import { z } from 'zod';
import { PageStatus, PostVisibility, SeriesOrderStrategy } from '@prisma/client';

export const createSeriesSchema = z.object({
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, 'Invalid slug format'),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  orderStrategy: z.nativeEnum(SeriesOrderStrategy).default(SeriesOrderStrategy.MANUAL),
});

export const updateSeriesSchema = createSeriesSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createPostSchema = z.object({
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, 'Invalid slug format'),
  title: z.string().min(1).max(255),
  excerpt: z.string().min(1),
  content: z.string().min(1),
  categoryId: z.string().cuid().optional(),
  seriesId: z.string().cuid().optional(),
  coverMediaId: z.string().cuid().optional(),
  ogImageId: z.string().cuid().optional(),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().optional(),
  status: z.nativeEnum(PageStatus).default(PageStatus.DRAFT),
  visibility: z.nativeEnum(PostVisibility).default(PostVisibility.PUBLIC),
  publishedAt: z.coerce.date().optional(),
  scheduledAt: z.coerce.date().optional(),
  isHot: z.boolean().default(false),
  tagIds: z.array(z.string().cuid()).optional(),
});

export const updatePostSchema = createPostSchema.partial().extend({
  isActive: z.boolean().optional(),
  changeNote: z.string().optional(),
});

export const listPostsSchema = z.object({
  page: z.preprocess((val) => Number(val), z.number().min(1).default(1)),
  limit: z.preprocess((val) => Number(val), z.number().min(1).max(100).default(10)),
  search: z.string().optional(),
  status: z.nativeEnum(PageStatus).optional(),
  categoryId: z.string().cuid().optional(),
  authorId: z.string().cuid().optional(),
  isActive: z.preprocess((val) => val === 'true', z.boolean()).optional(),
});

export type ListPostsQuery = z.infer<typeof listPostsSchema>;
