import { z } from 'zod';
import { GameStationType } from '@prisma/client';
import { baseFilterSchema } from '../../common/validators/query.validators';

export const createGamingCenterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters long')
    .regex(
      /^[a-z0-9-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens',
    ),
  ownerId: z.string().min(1, 'Owner ID is required'),
  games: z.array(z.string()).max(100, 'Games list cannot exceed 100 items').optional().default([]),
});

export const updateGamingCenterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long').optional(),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters long')
    .regex(
      /^[a-z0-9-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens',
    )
    .optional(),
  isActive: z.boolean().optional(),
  games: z.array(z.string()).max(100, 'Games list cannot exceed 100 items').optional(),
});

export const ALLOWED_GAMING_CENTER_INCLUDES = ['addresses', 'stations', 'ratings', 'settings', 'media', 'discounts'] as const;
export type GamingCenterIncludeField = (typeof ALLOWED_GAMING_CENTER_INCLUDES)[number];

export const ALLOWED_GAMING_CENTER_FIELDS = [
  'id',
  'name',
  'isActive',
  'slug',
  'description',
  'verificationStatus',
  'verifiedAt',
  'pcCount',
  'consoleCount',
  'openingTime',
  'closingTime',
  'closedDays',
  'timezone',
  'hourlyRate',
  'vipHourlyRate',
  'hasFoodService',
  'games',
  'createdAt',
  'updatedAt',
] as const;
export type GamingCenterScalarField = (typeof ALLOWED_GAMING_CENTER_FIELDS)[number];

export const getGamingCenterDetailsSchema = z.object({
  include: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const raw = Array.isArray(val) ? val.join(',') : val;
      return raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean) as GamingCenterIncludeField[];
    })
    .refine(
      (includes) =>
        !includes || includes.every((item) => ALLOWED_GAMING_CENTER_INCLUDES.includes(item)),
      {
        message: `Invalid include relation. Allowed relations are: ${ALLOWED_GAMING_CENTER_INCLUDES.join(', ')}`,
      }
    ),
  fields: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const raw = Array.isArray(val) ? val.join(',') : val;
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as GamingCenterScalarField[];
    })
    .refine(
      (fields) =>
        !fields || fields.every((item) => (ALLOWED_GAMING_CENTER_FIELDS as readonly string[]).includes(item)),
      {
        message: `Invalid field requested. Allowed fields are: ${ALLOWED_GAMING_CENTER_FIELDS.join(', ')}`,
      }
    ),
});

export type GetGamingCenterDetailsQuery = z.infer<typeof getGamingCenterDetailsSchema>;

export const listGamingCentersSchema = baseFilterSchema.extend({
  city: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  game: z.string().optional(),
  stationType: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const upper = val.toUpperCase();
        if (['PC', 'PLAYSTATION', 'XBOX', 'SWITCH', 'VR'].includes(upper)) {
          return upper;
        }
      }
      return val;
    },
    z.nativeEnum(GameStationType).optional()
  ),
  type: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const upper = val.toUpperCase();
        if (['PC', 'PLAYSTATION', 'XBOX', 'SWITCH', 'VR'].includes(upper)) {
          return upper;
        }
      }
      return val;
    },
    z.nativeEnum(GameStationType).optional()
  ),
  minStationCount: z.coerce.number().int().min(1).optional(),
  minHourlyRate: z.coerce.number().min(0).optional(),
  maxHourlyRate: z.coerce.number().min(0).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  hasFoodService: z.preprocess(
    (val) => (val === 'true' || val === true ? true : val === 'false' || val === false ? false : val),
    z.boolean().optional()
  ),
  minRating: z.coerce.number().min(0).max(5).optional(),
  isOpen: z.preprocess(
    (val) => (val === 'true' || val === true ? true : val === 'false' || val === false ? false : val),
    z.boolean().optional()
  ),
});

export type ListGamingCentersQuery = z.infer<typeof listGamingCentersSchema>;
