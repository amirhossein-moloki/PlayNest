import { z } from 'zod';

export const createClosureSchema = z.object({
  body: z.object({
    title: z.string().max(200).optional(),
    reason: z.string().max(500).optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  }).refine((data) => new Date(data.startDate) < new Date(data.endDate), {
    message: 'startDate must be strictly before endDate',
    path: ['endDate'],
  }),
  params: z.object({
    gamingCenterId: z.string().min(1, 'gamingCenterId is required'),
  }),
});

export const getClosuresSchema = z.object({
  params: z.object({
    gamingCenterId: z.string().min(1, 'gamingCenterId is required'),
  }),
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }).optional(),
});

export const deleteClosureSchema = z.object({
  params: z.object({
    gamingCenterId: z.string().min(1, 'gamingCenterId is required'),
    closureId: z.string().min(1, 'closureId is required'),
  }),
});

export type CreateClosureInput = z.infer<typeof createClosureSchema>['body'];
