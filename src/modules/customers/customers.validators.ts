import { z } from 'zod';

export const createCustomerSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^09\d{9}$/, 'Invalid Iranian phone number format'),
    fullName: z.string().optional(),
    displayName: z.string().optional(),
    note: z.string().optional(),
  }),
});

export const updateCustomerSchema = z.object({
  body: z.object({
    displayName: z.string().optional(),
    note: z.string().optional(),
  }),
  params: z.object({
    gamingCenterId: z.string().cuid(),
    customerId: z.string().cuid(),
  }),
});

export const getCustomersSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
  params: z.object({
    gamingCenterId: z.string().cuid(),
  }),
});

export const customerIdParamSchema = z.object({
  params: z.object({
    gamingCenterId: z.string().cuid(),
    customerId: z.string().cuid(),
  }),
});
