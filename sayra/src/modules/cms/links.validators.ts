import { z } from 'zod';
import { LinkType } from '@prisma/client';

export const linkBodySchema = z.object({
  type: z.nativeEnum(LinkType),
  label: z.string().optional(),
  value: z.string().min(1),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateLinkBodySchema = linkBodySchema.partial();

export const createLinkSchema = z.object({
  body: linkBodySchema,
});

export const updateLinkSchema = z.object({
  body: updateLinkBodySchema,
});

export type CreateLinkInput = z.infer<typeof createLinkSchema>['body'];
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>['body'];
