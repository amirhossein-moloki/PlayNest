import { z } from 'zod';
import { ReservationSource, ReservationStatus } from '@prisma/client';

const CUID_MESSAGE = 'Invalid CUID format';

export const groupBookingItemSchema = z.object({
  stationId: z.string().cuid(CUID_MESSAGE),
  staffId: z.string().cuid(CUID_MESSAGE).optional(),
});

export const customerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone must be at least 10 characters'),
  email: z.string().email('Invalid email address').optional(),
});

export const createPublicGroupReservationSchema = z.object({
  headers: z.object({
    'idempotency-key': z.string().min(16).max(128).optional(),
  }).passthrough().optional(),
  params: z.object({
    gamingCenterSlug: z.string(),
  }),
  body: z.object({
    startTime: z.string().datetime(),
    durationMinutes: z.number().int().min(15).max(1440).optional().default(60),
    items: z.array(groupBookingItemSchema).min(1, 'At least one station item is required'),
    customer: customerSchema,
    note: z.string().max(500).optional(),
  }),
});

export const checkoutGroupReservationSchema = z.object({
  headers: z.object({
    'idempotency-key': z.string().min(16).max(128).optional(),
  }).passthrough().optional(),
  params: z.object({
    gamingCenterSlug: z.string(),
  }),
  body: z.object({
    startTime: z.string().datetime(),
    durationMinutes: z.number().int().min(15).max(1440).optional().default(60),
    items: z.array(groupBookingItemSchema).min(1, 'At least one station item is required'),
    customer: customerSchema,
    note: z.string().max(500).optional(),
    provider: z.string().optional(),
  }),
});

export const createGroupBookingSchema = z.object({
  params: z.object({
    gamingCenterId: z.string(),
  }),
  body: z.object({
    startTime: z.string().datetime(),
    durationMinutes: z.number().int().min(15).max(1440).optional().default(60),
    items: z.array(groupBookingItemSchema).min(1, 'At least one station item is required'),
    customer: customerSchema,
    note: z.string().max(500).optional(),
    source: z.nativeEnum(ReservationSource).optional(),
  }),
});

export const listGroupBookingQuerySchema = z.object({
  params: z.object({
    gamingCenterId: z.string(),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
    status: z.nativeEnum(ReservationStatus).optional(),
    customerProfileId: z.string().cuid(CUID_MESSAGE).optional(),
    customerAccountId: z.string().cuid(CUID_MESSAGE).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  }),
});

export const groupBookingIdParamSchema = z.object({
  params: z.object({
    gamingCenterId: z.string(),
    id: z.string().cuid(CUID_MESSAGE),
  }),
});

export const cancelGroupBookingSchema = z.object({
  params: z.object({
    gamingCenterId: z.string(),
    id: z.string().cuid(CUID_MESSAGE),
  }),
  body: z.object({
    reason: z.string().max(500).optional(),
  }).optional(),
});

export type CreatePublicGroupReservationInput = z.infer<typeof createPublicGroupReservationSchema>['body'];
export type CreateGroupBookingInput = z.infer<typeof createGroupBookingSchema>['body'];
export type ListGroupBookingQuery = z.infer<typeof listGroupBookingQuerySchema>['query'];
