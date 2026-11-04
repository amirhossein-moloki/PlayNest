import { z } from 'zod';

export const listPlatformAdRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']).optional(),
  gamingCenterId: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  city: z.string().trim().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'startDate', 'endDate', 'durationDays', 'title', 'status'])
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
      durationDays: z.coerce.number().int().positive().optional(),
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
