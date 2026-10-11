import { z } from 'zod';

export const createAddressSchema = z.object({
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

export const updateAddressSchema = createAddressSchema.partial();
