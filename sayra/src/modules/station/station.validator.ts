import { z } from 'zod';
import { GameStationType } from '@prisma/client';
import { baseFilterSchema } from '../../common/validators/query.validators';

// Base schema for common fields
const stationBaseSchema = {
  name: z.string().min(1, 'Name is required'),
  stationType: z.nativeEnum(GameStationType).default(GameStationType.PC),
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

// Schema for updating an existing station
export const updateStationSchema = z.object({
  body: z.object({
    name: stationBaseSchema.name.optional(),
    stationType: z.nativeEnum(GameStationType).optional(),
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

// Schema for creating station maintenance
export const createMaintenanceSchema = z.object({
  params: z.object({
    gamingCenterId: z.string().cuid('Invalid gamingCenterId format'),
    stationId: z.string().cuid('Invalid stationId format'),
  }),
  body: z
    .object({
      startTime: z.string().datetime({ message: 'startTime must be a valid ISO date-time string' }),
      endTime: z.string().datetime({ message: 'endTime must be a valid ISO date-time string' }).optional(),
      reason: z.string().min(1, 'Reason is required').max(500, 'Reason cannot exceed 500 characters'),
      cost: z.number().min(0, 'Cost cannot be negative').optional(),
    })
    .refine(
      (data) => {
        if (data.endTime) {
          return new Date(data.endTime) > new Date(data.startTime);
        }
        return true;
      },
      {
        message: 'endTime must be strictly after startTime',
        path: ['endTime'],
      }
    ),
});

// Schema for deleting station maintenance
export const deleteMaintenanceSchema = z.object({
  params: z.object({
    gamingCenterId: z.string().cuid('Invalid gamingCenterId format'),
    stationId: z.string().cuid('Invalid stationId format'),
    maintenanceId: z.string().cuid('Invalid maintenanceId format'),
  }),
});

// Schema for listing station maintenance
export const listMaintenanceSchema = z.object({
  params: z.object({
    gamingCenterId: z.string().cuid('Invalid gamingCenterId format'),
    stationId: z.string().cuid('Invalid stationId format'),
  }),
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>['body'];
export type ListMaintenanceQuery = z.infer<typeof listMaintenanceSchema>['query'];

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
