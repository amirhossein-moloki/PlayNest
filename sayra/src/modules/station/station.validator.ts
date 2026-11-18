import { z } from 'zod';
import { GameStationType } from '@prisma/client';
import { baseFilterSchema } from '../../common/validators/query.validators';
import { idSchema } from '../../common/validators/common.validators';

// Extra Controller config item schema
export const extraControllerConfigItemSchema = z.object({
  controllerType: z.string().trim().min(1, 'Controller type is required').max(100),
  quantity: z.number().int().min(0, 'Quantity cannot be negative').max(100),
  hourlyPrice: z.number().min(0, 'Hourly price cannot be negative'),
  isActive: z.boolean().optional().default(true),
});

export const replaceExtraControllersSchema = z.object({
  params: z.object({
    stationId: idSchema('Invalid station ID format'),
  }),
  body: z.object({
    extraControllers: z.array(extraControllerConfigItemSchema),
  }),
});

export const createExtraControllerSchema = z.object({
  params: z.object({
    stationId: idSchema('Invalid station ID format'),
  }),
  body: extraControllerConfigItemSchema,
});

export const updateExtraControllerSchema = z.object({
  params: z.object({
    stationId: idSchema('Invalid station ID format'),
    extraControllerId: idSchema('Invalid extra controller ID format'),
  }),
  body: extraControllerConfigItemSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided to update' }
  ),
});

export const extraControllerIdParamSchema = z.object({
  params: z.object({
    stationId: idSchema('Invalid station ID format'),
    extraControllerId: idSchema('Invalid extra controller ID format'),
  }),
});

export const publicExtraControllersQuerySchema = z.object({
  params: z.object({
    stationId: idSchema('Invalid station ID format'),
  }),
  query: z.object({
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
  }),
});

// Base schema for common fields
const stationBaseSchema = {
  name: z.string().min(1, 'Name is required'),
  stationType: z.nativeEnum(GameStationType).default(GameStationType.PC),
  deviceTypeId: idSchema('Invalid deviceTypeId format').optional(),
  catalogDeviceId: idSchema('Invalid catalog device ID format').optional(),
  coverImageUrl: z.string().url('Invalid cover image URL').optional(),
  hourlyPrice: z.number().min(0, 'Hourly price cannot be negative'),
  minRentHours: z.number().int().positive().default(1),
  maxRentHours: z.number().int().positive().default(8),
  defaultDurationHours: z.number().int().positive().default(1),
  incrementMinutes: z.number().int().positive().default(30),
  isVip: z.boolean().optional(),
  isActive: z.boolean().optional(),
  extraControllers: z.array(extraControllerConfigItemSchema).optional(),
};

// Schema for creating a new station
export const createStationSchema = z.object({
  body: z.object({
    ...stationBaseSchema,
  }),
});

// Schema for creating stations from catalog device (with quantity and hourlyPrice)
export const createStationsFromCatalogSchema = z.object({
  body: z.object({
    catalogDeviceId: idSchema('Invalid catalog device ID format'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(100, 'Quantity cannot exceed 100'),
    hourlyPrice: z.number().min(0, 'Hourly price cannot be negative'),
    customNamePrefix: z.string().min(1).max(50).optional(),
    isVip: z.boolean().optional().default(false),
    minRentHours: z.number().int().positive().optional().default(1),
    maxRentHours: z.number().int().positive().optional().default(8),
    defaultDurationHours: z.number().int().positive().optional().default(1),
    incrementMinutes: z.number().int().positive().optional().default(30),
    extraControllers: z.array(extraControllerConfigItemSchema).optional(),
  }),
});

// Schema for adding catalog games to gaming center
export const addGamesFromCatalogSchema = z.object({
  body: z.object({
    gameCatalogIds: z.array(idSchema('Invalid game catalog ID format')).min(1, 'At least one game must be provided'),
  }),
});

// Schema for updating an existing station
export const updateStationSchema = z.object({
  body: z.object({
    name: stationBaseSchema.name.optional(),
    stationType: z.nativeEnum(GameStationType).optional(),
    deviceTypeId: stationBaseSchema.deviceTypeId.optional(),
    catalogDeviceId: stationBaseSchema.catalogDeviceId.optional(),
    coverImageUrl: stationBaseSchema.coverImageUrl.optional(),
    hourlyPrice: stationBaseSchema.hourlyPrice.optional(),
    minRentHours: stationBaseSchema.minRentHours.optional(),
    maxRentHours: stationBaseSchema.maxRentHours.optional(),
    defaultDurationHours: stationBaseSchema.defaultDurationHours.optional(),
    incrementMinutes: stationBaseSchema.incrementMinutes.optional(),
    isVip: stationBaseSchema.isVip.optional(),
    isActive: stationBaseSchema.isActive.optional(),
    extraControllers: stationBaseSchema.extraControllers.optional(),
  }),
  params: z.object({
    stationId: idSchema('Invalid station ID format'),
  }),
});

export const ALLOWED_STATION_FIELDS = [
  'id',
  'gamingCenterId',
  'name',
  'stationType',
  'catalogDeviceId',
  'coverImageUrl',
  'isVip',
  'hourlyPrice',
  'minRentHours',
  'maxRentHours',
  'defaultDurationHours',
  'incrementMinutes',
  'isActive',
  'createdAt',
  'updatedAt',
] as const;

export type StationField = (typeof ALLOWED_STATION_FIELDS)[number];

export const listStationsSchema = baseFilterSchema.extend({
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  catalogDeviceId: idSchema('Invalid catalog device ID format').optional(),
  stationType: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const upper = val.toUpperCase();
        if (['PLAYSTATION', 'PC', 'XBOX', 'SWITCH', 'VR'].includes(upper)) {
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
        if (['PLAYSTATION', 'PC', 'XBOX', 'SWITCH', 'VR'].includes(upper)) {
          return upper;
        }
      }
      return val;
    },
    z.nativeEnum(GameStationType).optional()
  ),
  isVip: z.coerce.boolean().optional(),
  staffId: z.string().optional(),
  ids: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const raw = Array.isArray(val) ? val.join(',') : val;
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }),
  fields: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const raw = Array.isArray(val) ? val.join(',') : val;
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as StationField[];
    })
    .refine(
      (fields) =>
        !fields || fields.every((item) => (ALLOWED_STATION_FIELDS as readonly string[]).includes(item)),
      {
        message: `Invalid field requested. Allowed station fields are: ${ALLOWED_STATION_FIELDS.join(', ')}`,
      }
    ),
});

export type ListStationsQuery = z.infer<typeof listStationsSchema>;

// Schema for URL parameters that include a stationId
export const stationIdParamSchema = z.object({
  params: z.object({
    stationId: idSchema('Invalid station ID format'),
  }),
});
