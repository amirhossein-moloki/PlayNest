
import { z } from 'zod';
import { ReservationStatus } from '@prisma/client';

const CUID_MESSAGE = 'Invalid CUID';

// =================================
// Panel Schemas
// =================================

export const createBookingSchema = z.object({
  body: z.object({
    stationId: z.string().cuid(CUID_MESSAGE),
    staffId: z.string().cuid(CUID_MESSAGE),
    startTime: z.string().datetime(),
    customer: z.object({
      fullName: z.string().min(2),
      phone: z.string().min(10), // E.164 normalization will be handled in the station
      email: z.string().email().optional(),
    }),
    note: z.string().max(500).optional(),
  }),
});

export const updateBookingSchema = z.object({
  params: z.object({
    reservationId: z.string().cuid(CUID_MESSAGE),
  }),
  body: z.object({
    stationId: z.string().cuid(CUID_MESSAGE).optional(),
    staffId: z.string().cuid(CUID_MESSAGE).optional(),
    startTime: z.string().datetime().optional(),
    note: z.string().optional(),
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update.',
  }),
});

export const cancelBookingSchema = z.object({
  params: z.object({
    reservationId: z.string().cuid(CUID_MESSAGE),
  }),
  body: z.object({
    reason: z.string().optional(),
  }),
});

export const listBookingsQuerySchema = z.object({
  query: z.object({
    page: z.preprocess(Number, z.number().int().min(1)).optional(),
    pageSize: z.preprocess(Number, z.number().int().min(1).max(100)).optional(),
    sortBy: z.enum(['startTime', 'createdAt', 'status']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    status: z.nativeEnum(ReservationStatus).optional(),
    staffId: z.string().cuid(CUID_MESSAGE).optional(),
    customerProfileId: z.string().cuid(CUID_MESSAGE).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  }),
});


// =================================
// Public Schemas
// =================================

export const createPublicBookingSchema = z.object({
  headers: z.object({
    'idempotency-key': z.string().min(16).max(128),
  }),
  params: z.object({
    gamingCenterSlug: z.string(),
  }),
  body: z.object({
    stationId: z.string().cuid(CUID_MESSAGE),
    staffId: z.string().cuid(CUID_MESSAGE),
    startTime: z.string().datetime(),
    customer: z.object({
      fullName: z.string().min(2),
      phone: z.string().min(10), // E.164 normalization will be handled in the station
      email: z.string().email().optional(),
    }),
    note: z.string().max(500).optional(),
  }),
});


// = a single source of truth for types
export type CreateBookingInput = z.infer<typeof createBookingSchema>['body'];
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>['body'];
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>['body'];
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>['query'];
export type CreatePublicBookingInput = z.infer<typeof createPublicBookingSchema>['body'];
