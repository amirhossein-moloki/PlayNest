import { z } from 'zod';
import { PageStatus, PageType, RobotsIndex, RobotsFollow } from '@prisma/client';

export const createPageSchema = z.object({
  body: z.object({
    slug: z.string().min(1).max(255),
    title: z.string().min(1).max(255),
    type: z.nativeEnum(PageType).optional(),
    parentId: z.string().cuid().optional().nullable(),
    status: z.nativeEnum(PageStatus).optional(),
    publishedAt: z.coerce.date().optional(),
    content: z.string().optional(),
    seoTitle: z.string().max(255).optional(),
    seoDescription: z.string().optional(),
    canonicalPath: z.string().optional(),
    ogTitle: z.string().max(255).optional(),
    ogDescription: z.string().optional(),
    ogImageUrl: z.string().url().optional().nullable(),
    robotsIndex: z.nativeEnum(RobotsIndex).optional(),
    robotsFollow: z.nativeEnum(RobotsFollow).optional(),
    structuredDataJson: z.string().optional(),
  }),
});

export const updatePageSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    slug: z.string().min(1).max(255).optional(),
    title: z.string().min(1).max(255).optional(),
    type: z.nativeEnum(PageType).optional(),
    parentId: z.string().cuid().optional().nullable(),
    status: z.nativeEnum(PageStatus).optional(),
    publishedAt: z.coerce.date().optional().nullable(),
    content: z.string().optional(),
    seoTitle: z.string().max(255).optional(),
    seoDescription: z.string().optional(),
    canonicalPath: z.string().optional(),
    ogTitle: z.string().max(255).optional(),
    ogDescription: z.string().optional(),
    ogImageUrl: z.string().url().optional().nullable(),
    robotsIndex: z.nativeEnum(RobotsIndex).optional(),
    robotsFollow: z.nativeEnum(RobotsFollow).optional(),
    structuredDataJson: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const getPageByPathSchema = z.object({
  query: z.object({
    path: z.string().min(1),
  }),
});
