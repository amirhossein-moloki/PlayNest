import { z } from 'zod';
import { GameStationType } from '@prisma/client';
import { baseFilterSchema } from '../../common/validators/query.validators';

// Base schema for common fields
const stationBaseSchema = {
  name: z.string().min(1, 'Name is required'),
  stationType: z.nativeEnum(GameStationType).default(GameStationType.PC),
  catalogDeviceId: z.string().cuid('Invalid catalog device ID format').optional(),
  coverImageUrl: z.string().url('Invalid cover image URL').optional(),
  hourlyPrice: z.number().min(0, 'Hourly price cannot be negative'),
  minRentHours: z.number().int().positive().default(1),
  maxRentHours: z.number().int().positive().default(8),
  defaultDurationHours: z.number().int().positive().default(1),
  incrementMinutes: z.number().int().positive().default(30),
  isVip: z.boolean().optional(),
  isActive: z.boolean().optional(),
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
    catalogDeviceId: z.string().cuid('Invalid catalog device ID format'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(100, 'Quantity cannot exceed 100'),
    hourlyPrice: z.number().min(0, 'Hourly price cannot be negative'),
    customNamePrefix: z.string().min(1).max(50).optional(),
    isVip: z.boolean().optional().default(false),
    minRentHours: z.number().int().positive().optional().default(1),
    maxRentHours: z.number().int().positive().optional().default(8),
    defaultDurationHours: z.number().int().positive().optional().default(1),
    incrementMinutes: z.number().int().positive().optional().default(30),
  }),
});

// Schema for adding catalog games to gaming center
export const addGamesFromCatalogSchema = z.object({
  body: z.object({
    gameCatalogIds: z.array(z.string().cuid('Invalid game catalog ID format')).min(1, 'At least one game must be provided'),
  }),
});

// Schema for updating an existing station
export const updateStationSchema = z.object({
  body: z.object({
    name: stationBaseSchema.name.optional(),
    stationType: z.nativeEnum(GameStationType).optional(),
    catalogDeviceId: stationBaseSchema.catalogDeviceId.optional(),
    coverImageUrl: stationBaseSchema.coverImageUrl.optional(),
    hourlyPrice: stationBaseSchema.hourlyPrice.optional(),
    minRentHours: stationBaseSchema.minRentHours.optional(),
    maxRentHours: stationBaseSchema.maxRentHours.optional(),
    defaultDurationHours: stationBaseSchema.defaultDurationHours.optional(),
    incrementMinutes: stationBaseSchema.incrementMinutes.optional(),
    isVip: stationBaseSchema.isVip.optional(),
    isActive: stationBaseSchema.isActive.optional(),
  }),
  params: z.object({
    stationId: z.string().cuid('Invalid station ID format'),
  }),
});

export const listStationsSchema = baseFilterSchema.extend({
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  stationType: z.nativeEnum(GameStationType).optional(),
  isVip: z.coerce.boolean().optional(),
  staffId: z.string().optional(),
});

export type ListStationsQuery = z.infer<typeof listStationsSchema>;

// Schema for URL parameters that include a stationId
export const stationIdParamSchema = z.object({
  params: z.object({
    stationId: z.string().cuid('Invalid station ID format'),
  }),
});
