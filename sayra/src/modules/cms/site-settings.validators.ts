import { z } from 'zod';
import { RobotsFollow, RobotsIndex } from '@prisma/client';

const urlSchema = z.string().url('Must be a valid URL.');

export const updateSiteSettingsSchema = z.object({
  body: z
    .object({
      logoUrl: urlSchema.optional().nullable(),
      faviconUrl: urlSchema.optional().nullable(),
      defaultSeoTitle: z.string().min(1).optional().nullable(),
      defaultSeoDescription: z.string().min(1).optional().nullable(),
      defaultOgImageUrl: urlSchema.optional().nullable(),
      googleSiteVerification: z.string().min(1).optional().nullable(),
      analyticsTag: z.string().min(1).optional().nullable(),
      robotsIndex: z.nativeEnum(RobotsIndex).optional(),
      robotsFollow: z.nativeEnum(RobotsFollow).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided to update.',
    }),
});

export type UpdateSiteSettingsInput = z.infer<
  typeof updateSiteSettingsSchema
>['body'];
