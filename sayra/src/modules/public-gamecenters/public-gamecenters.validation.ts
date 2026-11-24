import { GamePlayMode, GameStationType } from '@prisma/client';
import { z } from 'zod';
import { zodGameStationTypeOptional } from '../../common/utils/station-type';
import { parseOptionalBoolean } from '../../common/validators/query.validators';
import { isValidCoordinatePair, parseSearchDeviceAlias } from '../../common/utils/searchText';
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

const searchDeviceTypeOptional = () =>
  z.preprocess(
    (val) => (typeof val === 'string' ? parseSearchDeviceAlias(val) ?? val : val),
    zodGameStationTypeOptional()
  );

export const listPublicGameCentersQuerySchema = z
  .object({
    ids: z
      .preprocess(parseOptionalCommaArray, z.array(z.string().min(1)).max(MAX_BATCH_GAMECENTER_IDS).optional()),
    city: optionalTrimmedString,
    province: optionalTrimmedString,
    neighborhood: optionalTrimmedString,
    district: optionalTrimmedString,
    status: z.enum(['active', 'open_now']).optional().default('active'),
    isOpen: parseOptionalBoolean(),
    deviceType: searchDeviceTypeOptional() as z.ZodType<GameStationType | undefined>,
    amenities: z.preprocess(
      (val) => {
        const parsed = parseOptionalCommaArray(val);
        return parsed ? parsed.map((item) => item.toLowerCase()) : undefined;
      },
      z.array(z.enum(['food_service', 'vip', 'online_booking', 'online_games', 'extra_controllers'])).optional()
    ),
    search: optionalTrimmedString,
    q: optionalTrimmedString,
    game: optionalTrimmedString,
    gameId: optionalTrimmedString,
    gameSlug: optionalTrimmedString,
    playMode: z.preprocess(
      (val) => (typeof val === 'string' ? val.trim().toUpperCase() : val),
      z.nativeEnum(GamePlayMode).optional()
    ),
    minPrice: z.coerce.number().finite().min(0).optional(),
    maxPrice: z.coerce.number().finite().min(0).optional(),
    minRating: z.coerce.number().finite().min(0).max(5).optional(),
    lat: z.coerce.number().finite().min(-90).max(90).optional(),
    lng: z.coerce.number().finite().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().finite().min(0.5).max(200).optional(),
    sort: z
      .enum(['newest', 'bayesian', 'rating', 'reviews', 'price_asc', 'price_desc', 'distance'])
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .superRefine((data, ctx) => {
    const hasLat = data.lat !== undefined;
    const hasLng = data.lng !== undefined;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Both lat and lng must be provided together',
        path: [hasLat ? 'lng' : 'lat'],
      });
    } else if (hasLat && hasLng && !isValidCoordinatePair(data.lat, data.lng)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid coordinates provided',
        path: ['lat'],
      });
    }
    if (data.minPrice !== undefined && data.maxPrice !== undefined && data.minPrice > data.maxPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minPrice cannot exceed maxPrice',
        path: ['minPrice'],
      });
    }
  })
  .transform((data) => ({
    ...data,
    search: data.search || data.q,
    status: data.isOpen === true ? ('open_now' as const) : data.status,
  }));

export type ListPublicGameCentersQuery = z.infer<typeof listPublicGameCentersQuerySchema>;

export const rankingsQuerySchema = z.object({
  city: optionalTrimmedString,
  province: optionalTrimmedString,
  neighborhood: optionalTrimmedString,
  district: optionalTrimmedString,
  deviceType: searchDeviceTypeOptional() as z.ZodType<GameStationType | undefined>,
  amenities: z.preprocess(
    (val) => {
      const parsed = parseOptionalCommaArray(val);
      return parsed ? parsed.map((item) => item.toLowerCase()) : undefined;
    },
    z.array(z.enum(['food_service', 'vip', 'online_booking', 'online_games', 'extra_controllers'])).optional()
  ),
  game: optionalTrimmedString,
  gameId: optionalTrimmedString,
  gameSlug: optionalTrimmedString,
  playMode: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toUpperCase() : val),
    z.nativeEnum(GamePlayMode).optional()
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
