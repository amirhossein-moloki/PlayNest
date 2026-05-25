import { z } from 'zod';
import { baseFilterSchema } from '../../common/validators/query.validators';

// Base schema for common fields
const serviceBaseSchema = {
  name: z.string().min(1, 'Name is required'),
  durationMinutes: z.number().int().positive('Duration must be a positive integer'),
  price: z.number().int().min(0, 'Price cannot be negative'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  isActive: z.boolean().optional(),
};

// Schema for creating a new station
export const createServiceSchema = z.object({
  body: z.object({
    ...serviceBaseSchema,
  }),
});

// Schema for updating an existing station
export const updateServiceSchema = z.object({
  body: z.object({
    name: serviceBaseSchema.name.optional(),
    durationMinutes: serviceBaseSchema.durationMinutes.optional(),
    price: serviceBaseSchema.price.optional(),
    currency: serviceBaseSchema.currency.optional(),
    isActive: serviceBaseSchema.isActive.optional(),
  }),
  params: z.object({
    stationId: z.string().cuid('Invalid station ID format'),
  }),
});

export const listServicesSchema = baseFilterSchema.extend({
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minDuration: z.coerce.number().optional(),
  maxDuration: z.coerce.number().optional(),
  staffId: z.string().optional(),
});

export type ListServicesQuery = z.infer<typeof listServicesSchema>;

// Schema for URL parameters that include a stationId
export const serviceIdParamSchema = z.object({
  params: z.object({
    stationId: z.string().cuid('Invalid station ID format'),
  }),
});
