import { z } from 'zod';

export const addressBodySchema = z.object({
  title: z.string().optional(),
  province: z.string().optional(),
  city: z.string().min(1),
  district: z.string().optional(),
  addressLine: z.string().min(1),
  postalCode: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isPrimary: z.boolean().optional(),
});

export const updateAddressBodySchema = addressBodySchema.partial();

export const createAddressSchema = z.object({
  body: addressBodySchema,
});

export const updateAddressSchema = z.object({
  body: updateAddressBodySchema,
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>['body'];
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>['body'];
