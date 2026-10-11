import { z } from 'zod';
import { LinkType } from '@prisma/client';

export const createLinkSchema = z.object({
  type: z.nativeEnum(LinkType),
  label: z.string().optional(),
  value: z.string().min(1),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateLinkSchema = createLinkSchema.partial();
