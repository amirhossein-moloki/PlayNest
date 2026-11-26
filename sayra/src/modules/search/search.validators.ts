import { GamePlayMode, GameStationType } from '@prisma/client';
import { z } from 'zod';
import { formatInTimeZone } from 'date-fns-tz';
import { parseOptionalBoolean } from '../../common/validators/query.validators';
import { isValidCoordinatePair, parseSearchDeviceAlias } from '../../common/utils/searchText';
import { GAME_CATALOG_CATEGORIES } from '../catalog/catalog.validator';
import { PublicAmenityKey } from '../public-gamecenters/public-gamecenters.types';

const ALLOWED_AMENITIES = [
  'food_service',
  'vip',
  'online_booking',
  'online_games',
  'extra_controllers',
] as const;

const parseCommaList = (val: unknown): string[] | undefined => {
  if (val === undefined || val === null || val === '') return undefined;
  const arr = Array.isArray(val) ? val : [val];
  const tokens = arr
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    .map((s) => s.trim())
    .filter(Boolean);
  if (tokens.length === 0) return undefined;
  return Array.from(new Set(tokens));
};

const optionalTrimmedString = z
  .string()
  .trim()
  .max(120, 'Search query parameter cannot exceed 120 characters')
  .optional()
  .transform((val) => {
    return val && val.length > 0 ? val : undefined;
  });

const parseDeviceTypesList = (val: unknown): unknown => {
  const tokens = parseCommaList(val);
  if (!tokens) return undefined;
  return tokens.map((token) => parseSearchDeviceAlias(token) ?? token);
};

export const searchGameCentersQuerySchema = z
  .object({
    q: optionalTrimmedString,
    search: optionalTrimmedString,
    game: optionalTrimmedString,
    gameId: optionalTrimmedString,
    gameSlug: optionalTrimmedString,
    gameIds: z.preprocess(
      parseCommaList,
      z.array(z.string().min(1)).max(10).optional()
    ),
    playMode: z.preprocess(
      (val) => (typeof val === 'string' ? val.trim().toUpperCase() : val),
      z.nativeEnum(GamePlayMode).optional()
    ),
    city: optionalTrimmedString,
    province: optionalTrimmedString,
    neighborhood: optionalTrimmedString,
    district: optionalTrimmedString,
    lat: z.coerce.number().finite().min(-90).max(90).optional(),
    lng: z.coerce.number().finite().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().finite().min(0.5).max(200).optional(),
    deviceType: z.preprocess(
      parseDeviceTypesList,
      z.array(z.nativeEnum(GameStationType)).optional()
    ),
    stationType: z.preprocess(
      parseDeviceTypesList,
      z.array(z.nativeEnum(GameStationType)).optional()
    ),
    type: z.preprocess(
      parseDeviceTypesList,
      z.array(z.nativeEnum(GameStationType)).optional()
    ),
    amenities: z.preprocess(
      (val) => {
        const list = parseCommaList(val);
        return list ? list.map((x) => x.toLowerCase()) : undefined;
      },
      z.array(z.enum(ALLOWED_AMENITIES)).optional()
    ),
    hasFoodService: parseOptionalBoolean(),
    isVip: parseOptionalBoolean(),
    allowOnlineBooking: parseOptionalBoolean(),
    hasDiscount: parseOptionalBoolean(),
    minPrice: z.coerce.number().finite().min(0).optional(),
    maxPrice: z.coerce.number().finite().min(0).optional(),
    minHourlyRate: z.coerce.number().finite().min(0).optional(),
    maxHourlyRate: z.coerce.number().finite().min(0).optional(),
    minRating: z.coerce.number().finite().min(0).max(5).optional(),
    minStationCount: z.coerce.number().int().min(1).max(200).optional(),
    isOpen: parseOptionalBoolean(),
    status: z.enum(['active', 'open_now']).optional(),
    availableNow: parseOptionalBoolean(),
    availableAt: z.string().datetime().optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
      .optional(),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'startTime must be formatted as HH:mm')
      .optional(),
    durationHours: z.coerce.number().int().min(1).max(12).optional().default(1),
    minAvailableStations: z.coerce.number().int().min(1).max(50).optional().default(1),
    sort: z
      .enum([
        'relevance',
        'bayesian',
        'rating',
        'reviews',
        'price_asc',
        'price_desc',
        'distance',
        'newest',
      ])
      .optional()
      .default('relevance'),
    includeFacets: parseOptionalBoolean().transform((v) => (v === undefined ? true : v)),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .superRefine((data, ctx) => {
    const resolvedMinPrice = data.minPrice ?? data.minHourlyRate;
    const resolvedMaxPrice = data.maxPrice ?? data.maxHourlyRate;
    if (
      resolvedMinPrice !== undefined &&
      resolvedMaxPrice !== undefined &&
      resolvedMinPrice > resolvedMaxPrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minPrice cannot exceed maxPrice',
        path: ['minPrice'],
      });
    }

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
        message: 'Coordinates (0, 0) or out-of-range coordinates are not allowed',
        path: ['lat'],
      });
    }

    if (data.sort === 'distance' && (!hasLat || !hasLng)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sort=distance requires valid lat and lng parameters',
        path: ['sort'],
      });
    }
  })
  .transform((data) => {
    const mergedDevices = Array.from(
      new Set([
        ...(data.deviceType || []),
        ...(data.stationType || []),
        ...(data.type || []),
      ])
    );

    const amenitiesSet = new Set<PublicAmenityKey>(data.amenities || []);
    if (data.hasFoodService === true) amenitiesSet.add('food_service');
    if (data.isVip === true) amenitiesSet.add('vip');
    if (data.allowOnlineBooking === true) amenitiesSet.add('online_booking');

    const resolvedDate =
      data.date ??
      (data.startTime ? formatInTimeZone(new Date(), 'Asia/Tehran', 'yyyy-MM-dd') : undefined);

    return {
      ...data,
      queryText: data.q || data.search,
      neighborhood: data.neighborhood || data.district,
      deviceTypes: mergedDevices.length > 0 ? mergedDevices : undefined,
      amenities: amenitiesSet.size > 0 ? Array.from(amenitiesSet) : undefined,
      minPrice: data.minPrice ?? data.minHourlyRate,
      maxPrice: data.maxPrice ?? data.maxHourlyRate,
      isOpen: data.isOpen ?? (data.status === 'open_now' ? true : undefined),
      date: resolvedDate,
    };
  });

export type SearchGameCentersQuery = z.infer<typeof searchGameCentersQuerySchema>;

export const suggestQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'Search query q is required')
    .max(100, 'Search query cannot exceed 100 characters'),
  city: optionalTrimmedString,
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export type SearchSuggestQuery = z.infer<typeof suggestQuerySchema>;

export const searchGamesQuerySchema = z
  .object({
    q: optionalTrimmedString,
    search: optionalTrimmedString,
    platform: z.preprocess(
      (val) => (typeof val === 'string' ? parseSearchDeviceAlias(val) ?? val : val),
      z.nativeEnum(GameStationType).optional()
    ),
    deviceType: z.preprocess(
      (val) => (typeof val === 'string' ? parseSearchDeviceAlias(val) ?? val : val),
      z.nativeEnum(GameStationType).optional()
    ),
    category: z.enum(GAME_CATALOG_CATEGORIES).optional(),
    supportsOnline: parseOptionalBoolean(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .transform((data) => ({
    q: data.q || data.search,
    platform: data.platform || data.deviceType,
    category: data.category,
    supportsOnline: data.supportsOnline,
    page: data.page,
    limit: data.limit,
  }));

export type SearchGamesQuery = z.infer<typeof searchGamesQuerySchema>;
