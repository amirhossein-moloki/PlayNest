import { z } from 'zod';
import { MediaType } from '@prisma/client';

export const AD_TYPES = ['GAMING_CENTER', 'GLOBAL_PROMOTION', 'CATEGORY', 'CUSTOM_LINK'] as const;

export const createPlatformAdRequestSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200, 'Title is too long'),
      description: z.string().trim().max(2000, 'Description is too long').optional().nullable(),
      bannerUrl: z
        .string()
        .trim()
        .min(1, 'Banner URL is required')
        .refine(
          (val) => /^https?:\/\/.+/.test(val) || val.startsWith('/'),
          'Banner URL must be a valid HTTP(S) URL or relative path'
        ),
      mediaType: z.nativeEnum(MediaType).optional().default(MediaType.IMAGE),
      adType: z.enum(AD_TYPES).optional(),
      category: z.string().trim().min(1, 'Category cannot be empty').max(100, 'Category is too long').optional().nullable(),
      destinationUrl: z
        .string()
        .trim()
        .url('Invalid destination URL')
        .refine((val) => /^https?:\/\/.+/.test(val), 'Destination URL must use http or https protocol')
        .optional()
        .nullable()
        .or(z.literal('')),
      gamingCenterId: z
        .string()
        .trim()
        .min(1)
        .optional()
        .nullable()
        .or(z.literal(''))
        .transform((val) => (val === '' ? null : val)),
      ownerId: z
        .string()
        .trim()
        .min(1)
        .optional()
        .nullable()
        .or(z.literal(''))
        .transform((val) => (val === '' ? null : val)),
      mediaId: z
        .string()
        .trim()
        .min(1)
        .optional()
        .nullable()
        .or(z.literal(''))
        .transform((val) => (val === '' ? null : val)),
      status: z.enum(['APPROVED', 'PENDING']).optional().default('APPROVED'),
      durationDays: z.coerce.number().int().min(1, 'Duration must be at least 1 day').max(365, 'Duration cannot exceed 365 days').optional().default(30),
      priority: z.coerce.number().int().min(0).max(1000).optional().default(0),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      adminNote: z.string().trim().max(1000).optional().nullable(),
    })
    .superRefine((data, ctx) => {
      if (data.adType === 'CUSTOM_LINK' && (!data.destinationUrl || data.destinationUrl.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'destinationUrl is required for CUSTOM_LINK advertisements',
          path: ['destinationUrl'],
        });
      }
      if (data.adType === 'CATEGORY' && (!data.category || data.category.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'category is required for CATEGORY advertisements',
          path: ['category'],
        });
      }
      if (data.adType === 'GAMING_CENTER' && !data.gamingCenterId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'gamingCenterId is required when adType is GAMING_CENTER',
          path: ['gamingCenterId'],
        });
      }
      if (data.startDate && data.endDate && new Date(data.endDate) <= new Date(data.startDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endDate must be after startDate',
          path: ['endDate'],
        });
      }
    }),
});

export const listPlatformAdRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'EXPIRED', 'DELETED']).optional(),
  adType: z.enum(AD_TYPES).optional(),
  gamingCenterId: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  city: z.string().trim().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'startDate', 'endDate', 'durationDays', 'priority', 'title', 'status'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional().default('desc'),
});

export const updatePlatformAdRequestStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(['APPROVED', 'REJECTED']),
      decisionReason: z.string().trim().optional(),
      adminNote: z.string().trim().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      durationDays: z.coerce.number().int().positive().optional(),
      priority: z.coerce.number().int().min(0).max(1000).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.status === 'REJECTED' && (!data.decisionReason || data.decisionReason.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'decisionReason is required when rejecting an advertisement request',
          path: ['decisionReason'],
        });
      }
    }),
});
