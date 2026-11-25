import { z } from 'zod';
import { MediaPurpose, MediaType } from '@prisma/client';
import { idSchema, CUID_MESSAGE } from '../../common/validators/common.validators';
import { parseOptionalBoolean } from '../../common/validators/query.validators';
import { isLocalUploadPath } from '../../common/utils/image-validation';
const ALT_TEXT_REQUIRED_PURPOSES = new Set<MediaPurpose>([
  MediaPurpose.LOGO,
  MediaPurpose.COVER,
]);

const nonLocalUrlSchema = z
  .string()
  .min(1, 'URL is required')
  .refine((val) => !isLocalUploadPath(val), {
    message: 'Local /uploads paths must be uploaded via /media/upload.',
  });

const baseFields = {
  type: z.nativeEnum(MediaType).optional(),
  purpose: z.nativeEnum(MediaPurpose).optional(),
  url: nonLocalUrlSchema,
  thumbUrl: nonLocalUrlSchema.optional(),
  altText: z.string().min(1, 'Alt text is required').optional(),
  category: z.string().min(1).optional(),
  caption: z.string().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
};

const validateAltTextForPurpose = (
  purpose: MediaPurpose | undefined,
  altText: string | null | undefined,
  ctx: z.RefinementCtx
) => {
  if (purpose && ALT_TEXT_REQUIRED_PURPOSES.has(purpose) && !altText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Alt text is required for logo or cover media.',
      path: ['altText'],
    });
  }
};

export const createMediaSchema = z.object({
  body: z
    .object({
      ...baseFields,
    })
    .superRefine((data, ctx) => {
      validateAltTextForPurpose(data.purpose, data.altText, ctx);
    }),
});

export const uploadMediaSchema = z.object({
  body: z
    .object({
      purpose: baseFields.purpose,
      altText: baseFields.altText,
      category: baseFields.category,
      caption: baseFields.caption,
      sortOrder: z.coerce.number().int().min(0).optional(),
      isActive: parseOptionalBoolean(),
    })
    .superRefine((data, ctx) => {
      validateAltTextForPurpose(data.purpose, data.altText, ctx);
    }),
});

export const updateMediaSchema = z.object({
  params: z.object({
    mediaId: idSchema(CUID_MESSAGE),
  }),
  body: z
    .object({
      type: baseFields.type,
      purpose: baseFields.purpose,
      url: z.undefined().optional(),
      thumbUrl: z.undefined().optional(),
      altText: z.string().min(1, 'Alt text is required').nullable().optional(),
      category: baseFields.category.optional(),
      caption: baseFields.caption.optional(),
      sortOrder: baseFields.sortOrder.optional(),
      isActive: baseFields.isActive.optional(),
    })
    .superRefine((data, ctx) => {
      if (Object.keys(data).length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one field must be provided to update.',
          path: [],
        });
      }
      if (data.purpose) {
        validateAltTextForPurpose(data.purpose, data.altText, ctx);
      }
    }),
});

export const deleteMediaSchema = z.object({
  params: z.object({
    mediaId: idSchema(CUID_MESSAGE),
    gamingCenterId: idSchema(CUID_MESSAGE).optional(),
  }),
});

export type CreateMediaInput = z.infer<typeof createMediaSchema>['body'];
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>['body'];
