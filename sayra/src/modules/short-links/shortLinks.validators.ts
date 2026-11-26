import {
  AllowedDomainRuleType,
  ShortLinkCampaignStatus,
  ShortLinkStatus,
  ShortLinkTargetCategory,
} from '@prisma/client';
import { z } from 'zod';
import { idSchema } from '../../common/validators/common.validators';
import { parseOptionalBoolean } from '../../common/validators/query.validators';

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === '') return null;
      return v;
    });

const utmFieldSchema = optionalTrimmedString(128);

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{6}$/, 'Color must be a 6-digit hex code')
  .transform((v) => (v.startsWith('#') ? v : `#${v}`));

const qrConfigSchema = z
  .object({
    errorCorrectionLevel: z.enum(['L', 'M', 'Q', 'H']).optional(),
    foreground: hexColorSchema.optional(),
    background: hexColorSchema.optional(),
    margin: z.coerce.number().int().min(1).max(10).optional(),
    size: z.coerce.number().int().min(128).max(2048).optional(),
  })
  .optional()
  .nullable();

const optionalDateSchema = z
  .union([z.string().datetime(), z.date()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    return v instanceof Date ? v : new Date(v);
  });

export const createShortLinkSchema = z.object({
  body: z.object({
    destinationUrl: z.string().trim().min(1, 'destinationUrl is required').max(2048),
    customCode: z.string().trim().min(3).max(64).optional(),
    title: optionalTrimmedString(200),
    description: optionalTrimmedString(1000),
    targetCategory: z.nativeEnum(ShortLinkTargetCategory).optional().default(ShortLinkTargetCategory.OTHER),
    targetEntityId: optionalTrimmedString(128),
    gamingCenterId: idSchema('Invalid gamingCenterId format').optional(),
    campaignId: idSchema('Invalid campaignId format').optional().nullable(),
    utmSource: utmFieldSchema,
    utmMedium: utmFieldSchema,
    utmCampaign: utmFieldSchema,
    utmTerm: utmFieldSchema,
    utmContent: utmFieldSchema,
    appendUtmParams: z.boolean().optional().default(true),
    status: z.enum([ShortLinkStatus.ACTIVE, ShortLinkStatus.INACTIVE]).optional().default(ShortLinkStatus.ACTIVE),
    redirectStatusCode: z.coerce.number().int().refine((v) => v === 301 || v === 302, {
      message: 'redirectStatusCode must be 301 or 302',
    }).optional().default(302),
    expiresAt: optionalDateSchema,
    maxClicks: z.coerce.number().int().min(1).max(100_000_000).optional().nullable(),
    qrConfig: qrConfigSchema,
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  }),
});

export const updateShortLinkSchema = z.object({
  params: z.object({
    linkId: idSchema('Invalid link ID format'),
  }),
  body: z
    .object({
      destinationUrl: z.string().trim().min(1).max(2048).optional(),
      title: optionalTrimmedString(200),
      description: optionalTrimmedString(1000),
      targetCategory: z.nativeEnum(ShortLinkTargetCategory).optional(),
      targetEntityId: optionalTrimmedString(128),
      campaignId: idSchema('Invalid campaignId format').optional().nullable(),
      utmSource: utmFieldSchema,
      utmMedium: utmFieldSchema,
      utmCampaign: utmFieldSchema,
      utmTerm: utmFieldSchema,
      utmContent: utmFieldSchema,
      appendUtmParams: z.boolean().optional(),
      status: z.nativeEnum(ShortLinkStatus).optional(),
      redirectStatusCode: z.coerce
        .number()
        .int()
        .refine((v) => v === 301 || v === 302, { message: 'redirectStatusCode must be 301 or 302' })
        .optional(),
      expiresAt: optionalDateSchema,
      maxClicks: z.coerce.number().int().min(1).max(100_000_000).optional().nullable(),
      qrConfig: qrConfigSchema,
      metadata: z.record(z.string(), z.unknown()).optional().nullable(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one updatable field is required',
    }),
});

export const changeDestinationSchema = z.object({
  params: z.object({
    linkId: idSchema('Invalid link ID format'),
  }),
  body: z.object({
    destinationUrl: z.string().trim().min(1, 'destinationUrl is required').max(2048),
    reason: z.string().trim().max(500).optional(),
  }),
});

export const updateShortLinkStatusSchema = z.object({
  params: z.object({
    linkId: idSchema('Invalid link ID format'),
  }),
  body: z.object({
    status: z.nativeEnum(ShortLinkStatus),
    reason: z.string().trim().max(500).optional(),
  }),
});

export const shortLinkIdParamSchema = z.object({
  params: z.object({
    linkId: idSchema('Invalid link ID format'),
  }),
});

export const listShortLinksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  q: z.string().trim().max(200).optional(),
  status: z.nativeEnum(ShortLinkStatus).optional(),
  targetCategory: z.nativeEnum(ShortLinkTargetCategory).optional(),
  campaignId: idSchema('Invalid campaignId format').optional(),
  gamingCenterId: idSchema('Invalid gamingCenterId format').optional(),
  isCustomCode: parseOptionalBoolean(),
  expiredOnly: parseOptionalBoolean(),
  includeDeleted: parseOptionalBoolean(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'totalClicks', 'validClicks', 'lastClickedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const shortLinkStatsQuerySchema = z
  .object({
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
    granularity: z.enum(['day', 'hour']).optional().default('day'),
  })
  .superRefine((data, ctx) => {
    if (data.from && Number.isNaN(new Date(data.from).getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid from date', path: ['from'] });
    }
    if (data.to && Number.isNaN(new Date(data.to).getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid to date', path: ['to'] });
    }
    if (data.from && data.to && new Date(data.from) > new Date(data.to)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'from date cannot exceed to date', path: ['from'] });
    }
  });

export const qrCodeQuerySchema = z.object({
  format: z.enum(['svg', 'png', 'json', 'dataurl']).optional().default('svg'),
  size: z.coerce.number().int().min(128).max(2048).optional().default(320),
  margin: z.coerce.number().int().min(1).max(10).optional().default(4),
  ecc: z.enum(['L', 'M', 'Q', 'H']).optional().default('M'),
  fg: hexColorSchema.optional(),
  bg: hexColorSchema.optional(),
  download: parseOptionalBoolean().transform((v) => v === true),
});

export const createShortLinkCampaignSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, 'Campaign name must be at least 2 characters').max(150),
      slug: z
        .string()
        .trim()
        .min(2)
        .max(100)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Slug must be alphanumeric with hyphens')
        .optional(),
      description: optionalTrimmedString(1000),
      gamingCenterId: idSchema('Invalid gamingCenterId format').optional(),
      status: z.nativeEnum(ShortLinkCampaignStatus).optional().default(ShortLinkCampaignStatus.ACTIVE),
      adSource: optionalTrimmedString(128),
      utmSource: utmFieldSchema,
      utmMedium: utmFieldSchema,
      utmCampaign: utmFieldSchema,
      utmTerm: utmFieldSchema,
      utmContent: utmFieldSchema,
      startsAt: optionalDateSchema,
      endsAt: optionalDateSchema,
    })
    .superRefine((data, ctx) => {
      if (data.startsAt && data.endsAt && data.startsAt >= data.endsAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startsAt must be before endsAt',
          path: ['startsAt'],
        });
      }
    }),
});

export const updateShortLinkCampaignSchema = z.object({
  params: z.object({
    campaignId: idSchema('Invalid campaign ID format'),
  }),
  body: z
    .object({
      name: z.string().trim().min(2).max(150).optional(),
      description: optionalTrimmedString(1000),
      status: z.nativeEnum(ShortLinkCampaignStatus).optional(),
      adSource: optionalTrimmedString(128),
      utmSource: utmFieldSchema,
      utmMedium: utmFieldSchema,
      utmCampaign: utmFieldSchema,
      utmTerm: utmFieldSchema,
      utmContent: utmFieldSchema,
      startsAt: optionalDateSchema,
      endsAt: optionalDateSchema,
    })
    .superRefine((data, ctx) => {
      if (data.startsAt && data.endsAt && data.startsAt >= data.endsAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startsAt must be before endsAt',
          path: ['startsAt'],
        });
      }
    }),
});

export const updateCampaignStatusSchema = z.object({
  params: z.object({
    campaignId: idSchema('Invalid campaign ID format'),
  }),
  body: z.object({
    status: z.nativeEnum(ShortLinkCampaignStatus),
  }),
});

export const campaignIdParamSchema = z.object({
  params: z.object({
    campaignId: idSchema('Invalid campaign ID format'),
  }),
});

export const listCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.nativeEnum(ShortLinkCampaignStatus).optional(),
  gamingCenterId: idSchema('Invalid gamingCenterId format').optional(),
});

export const createDomainRuleSchema = z.object({
  body: z.object({
    domain: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(255)
      .regex(/^(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+$/, 'Domain must be a valid hostname (e.g. instagram.com)'),
    ruleType: z.nativeEnum(AllowedDomainRuleType).default(AllowedDomainRuleType.ALLOW),
    includeSubdomains: z.boolean().optional().default(true),
    isActive: z.boolean().optional().default(true),
    description: optionalTrimmedString(500),
  }),
});

export const updateDomainRuleSchema = z.object({
  params: z.object({
    ruleId: idSchema('Invalid domain rule ID format'),
  }),
  body: z.object({
    ruleType: z.nativeEnum(AllowedDomainRuleType).optional(),
    includeSubdomains: z.boolean().optional(),
    isActive: z.boolean().optional(),
    description: optionalTrimmedString(500),
  }),
});

export const domainRuleIdParamSchema = z.object({
  params: z.object({
    ruleId: idSchema('Invalid domain rule ID format'),
  }),
});

export type CreateShortLinkInput = z.infer<typeof createShortLinkSchema>['body'];
export type UpdateShortLinkInput = z.infer<typeof updateShortLinkSchema>['body'];
export type ListShortLinksQuery = z.infer<typeof listShortLinksQuerySchema>;
export type CreateShortLinkCampaignInput = z.infer<typeof createShortLinkCampaignSchema>['body'];
export type UpdateShortLinkCampaignInput = z.infer<typeof updateShortLinkCampaignSchema>['body'];
export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>;
