import { z, ZodError } from 'zod';
import {
  PageSectionType,
  PageStatus,
  PageType,
  RobotsFollow,
  RobotsIndex,
} from '@prisma/client';
import { validateSectionData } from './page-section-registry';

const CUID_MESSAGE = 'Invalid CUID';

const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be URL-safe and lowercase.',
  });

const canonicalPathSchema = z
  .string()
  .min(1)
  .regex(/^\/(?!\/)[^\s]*$/, {
    message: 'Canonical path must be a path starting with /.',
  });

const pageBaseSchema = {
  slug: slugSchema,
  title: z.string().min(1, 'Title is required'),
  type: z.nativeEnum(PageType),
  status: z.nativeEnum(PageStatus).optional(),
  publishedAt: z.string().datetime().optional(),
  seoTitle: z.string().min(1).optional(),
  seoDescription: z.string().min(1).optional(),
  canonicalPath: canonicalPathSchema.optional(),
  ogTitle: z.string().min(1).optional(),
  ogDescription: z.string().min(1).optional(),
  ogImageUrl: z.string().min(1).optional(),
  robotsIndex: z.nativeEnum(RobotsIndex).optional(),
  robotsFollow: z.nativeEnum(RobotsFollow).optional(),
  structuredDataJson: z.string().optional(),
};

const pageSectionSchema = z.object({
  id: z.string().cuid(CUID_MESSAGE).optional(),
  type: z.nativeEnum(PageSectionType),
  dataJson: z.string().min(1, 'Section data is required'),
  sortOrder: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional(),
});

const resolveSectionError = (
  error: unknown,
): { message: string; dataPath?: Array<string | number> } => {
  if (error instanceof ZodError && error.issues.length > 0) {
    const issue = error.issues[0];
    return { message: issue.message, dataPath: issue.path };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: 'Invalid section data.' };
};

const applySectionValidation = (schema: z.ZodArray<typeof pageSectionSchema>) =>
  schema.superRefine((sections, ctx) => {
    sections.forEach((section, index) => {
      try {
        validateSectionData(section.type, section.dataJson);
      } catch (error) {
        const { message, dataPath } = resolveSectionError(error);
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message,
          path: [index, 'dataJson', ...(dataPath ?? [])],
          params: { index, type: section.type, dataPath },
        });
      }
    });
  });

const pageSectionsSchema = applySectionValidation(z.array(pageSectionSchema));
const requiredPageSectionsSchema = applySectionValidation(
  z.array(pageSectionSchema).min(1, 'At least one section is required'),
);

export const createPageSchema = z.object({
  body: z.object({
    ...pageBaseSchema,
    sections: requiredPageSectionsSchema,
  }),
});

export const updatePageSchema = z.object({
  params: z.object({
    pageId: z.string().cuid(CUID_MESSAGE),
  }),
  body: z
    .object({
      slug: pageBaseSchema.slug.optional(),
      title: pageBaseSchema.title.optional(),
      type: pageBaseSchema.type.optional(),
      status: pageBaseSchema.status.optional(),
      publishedAt: pageBaseSchema.publishedAt.optional(),
      seoTitle: pageBaseSchema.seoTitle.optional(),
      seoDescription: pageBaseSchema.seoDescription.optional(),
      canonicalPath: pageBaseSchema.canonicalPath.optional(),
      ogTitle: pageBaseSchema.ogTitle.optional(),
      ogDescription: pageBaseSchema.ogDescription.optional(),
      ogImageUrl: pageBaseSchema.ogImageUrl.optional(),
      robotsIndex: pageBaseSchema.robotsIndex.optional(),
      robotsFollow: pageBaseSchema.robotsFollow.optional(),
      structuredDataJson: pageBaseSchema.structuredDataJson.optional(),
      sections: pageSectionsSchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided to update.',
    }),
});

export const listPagesSchema = z.object({
  query: z.object({
    status: z.nativeEnum(PageStatus).optional(),
    type: z.nativeEnum(PageType).optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
});

export const getPageSchema = z.object({
  params: z.object({
    pageId: z.string().cuid(CUID_MESSAGE),
  }),
});

export type CreatePageInput = z.infer<typeof createPageSchema>['body'];
export type UpdatePageInput = z.infer<typeof updatePageSchema>['body'];
