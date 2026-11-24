import { z } from 'zod';
import { zodGameStationTypeOptional } from '../../common/utils/station-type';
import { PublicAmenityKey } from './public-gamecenters.types';

export const ALLOWED_PUBLIC_AMENITIES: readonly PublicAmenityKey[] = [
  'food_service',
  'vip',
  'online_booking',
  'online_games',
  'extra_controllers',
] as const;

export const MAX_BATCH_GAMECENTER_IDS = 50;

const parseBooleanParam = (defaultValue?: boolean) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return defaultValue;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const normalized = val.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
    }
    return val;
  }, z.boolean());

const parseOptionalCommaArray = (val: unknown): string[] | undefined => {
  if (val === undefined || val === null || val === '') return undefined;
  const rawList = Array.isArray(val) ? val : [val];
  const tokens = rawList
    .flatMap((entry) => (typeof entry === 'string' ? entry.split(',') : []))
    .map((item) => item.trim())
    .filter(Boolean);
  if (tokens.length === 0) return undefined;
  return Array.from(new Set(tokens));
};

const optionalTrimmedString = z
  .string()
  .optional()
  .transform((val) => {
    const trimmed = val?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  });

export const listPublicGameCentersQuerySchema = z.object({
  ids: z
    .preprocess(parseOptionalCommaArray, z.array(z.string().min(1)).max(MAX_BATCH_GAMECENTER_IDS).optional()),
  city: optionalTrimmedString,
  neighborhood: optionalTrimmedString,
  district: optionalTrimmedString,
  status: z.enum(['active', 'open_now']).optional().default('active'),
  deviceType: zodGameStationTypeOptional(),
  amenities: z.preprocess(
    (val) => {
      const parsed = parseOptionalCommaArray(val);
      return parsed ? parsed.map((item) => item.toLowerCase()) : undefined;
    },
    z.array(z.enum(['food_service', 'vip', 'online_booking', 'online_games', 'extra_controllers'])).optional()
  ),
  search: optionalTrimmedString,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListPublicGameCentersQuery = z.infer<typeof listPublicGameCentersQuerySchema>;

export const rankingsQuerySchema = z.object({
  city: optionalTrimmedString,
  neighborhood: optionalTrimmedString,
  district: optionalTrimmedString,
  deviceType: zodGameStationTypeOptional(),
  amenities: z.preprocess(
    (val) => {
      const parsed = parseOptionalCommaArray(val);
      return parsed ? parsed.map((item) => item.toLowerCase()) : undefined;
    },
    z.array(z.enum(['food_service', 'vip', 'online_booking', 'online_games', 'extra_controllers'])).optional()
  ),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  newlyRegisteredLimit: z.coerce.number().int().min(1).max(50).default(10),
  minReviews: z.coerce.number().int().min(0).max(500).optional(),
  m: z.coerce.number().positive().max(500).optional(),
  sort: z
    .enum(['bayesian', 'rating', 'reviews', 'newest', 'price_asc', 'price_desc'])
    .optional()
    .default('bayesian'),
  includeNewlyRegistered: parseBooleanParam(true),
});

export type PublicGameCentersRankingsQuery = z.infer<typeof rankingsQuerySchema>;

export const publicGameCenterIdParamsSchema = z.object({
  id: z.string().trim().min(1, 'Gaming center identifier is required'),
});
