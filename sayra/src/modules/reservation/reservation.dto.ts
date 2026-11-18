
import { z } from 'zod';
import { ReservationStatus, CancellationCategory, CancellationActor } from '@prisma/client';
import { idSchema, CUID_MESSAGE } from '../../common/validators/common.validators';

// =================================
// Panel Schemas
// =================================

export const createReservationSchema = z.object({
  body: z.object({
    stationId: idSchema(CUID_MESSAGE),
    staffId: idSchema(CUID_MESSAGE),
    startTime: z.string().datetime(),
    durationHours: z.number().int().positive().max(24).optional(),
    customer: z.object({
      fullName: z.string().min(2),
      phone: z.string().min(10), // E.164 normalization will be handled in the station
      email: z.string().email().optional(),
    }),
    note: z.string().max(500).optional(),
    voucherCode: z.string().trim().optional(),
  }),
});

export const updateReservationSchema = z.object({
  params: z.object({
    reservationId: idSchema(CUID_MESSAGE),
  }),
  body: z.object({
    stationId: idSchema(CUID_MESSAGE).optional(),
    staffId: idSchema(CUID_MESSAGE).optional(),
    startTime: z.string().datetime().optional(),
    note: z.string().optional(),
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update.',
  }),
});

export const cancelReservationSchema = z.object({
  params: z.object({
    reservationId: idSchema(CUID_MESSAGE),
  }),
  body: z.object({
    reason: z.string().optional(),
    cancelCategory: z.nativeEnum(CancellationCategory).optional(),
    cancelActor: z.nativeEnum(CancellationActor).optional(),
  }),
});

export const rescheduleReservationSchema = z.object({
  params: z.object({
    reservationId: idSchema(CUID_MESSAGE),
  }),
  body: z.object({
    startTime: z.string().datetime(),
    stationId: idSchema(CUID_MESSAGE).optional(),
    staffId: idSchema(CUID_MESSAGE).optional(),
    reason: z.string().max(500).optional(),
  }),
});

export const proposeTimeSchema = z.object({
  params: z.object({
    reservationId: idSchema(CUID_MESSAGE),
  }),
  body: z
    .object({
      startTime: z.string().datetime().optional(),
      endTime: z.string().datetime().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
      slotTime: z.string().regex(/^\d{2}:\d{2}$/, 'slotTime must be HH:mm').optional(),
      durationHours: z.number().int().positive().max(24).optional(),
      note: z.string().max(500).optional(),
    })
    .refine(
      (data) => Boolean(data.startTime) || Boolean(data.date && data.slotTime),
      {
        message: 'Either startTime or both date and slotTime must be provided',
        path: ['startTime'],
      }
    )
    .refine(
      (data) => !data.startTime || !data.endTime || new Date(data.endTime) > new Date(data.startTime),
      {
        message: 'endTime must be after startTime',
        path: ['endTime'],
      }
    ),
});

export const proposalActionParamsSchema = z.object({
  params: z.object({
    reservationId: idSchema(CUID_MESSAGE),
    proposalId: idSchema(CUID_MESSAGE),
  }),
});

export const listProposalsParamsSchema = z.object({
  params: z.object({
    reservationId: idSchema(CUID_MESSAGE),
  }),
});

export const listReservationQuerySchema = z.object({
  query: z.object({
    page: z.preprocess(Number, z.number().int().min(1)).optional(),
    pageSize: z.preprocess(Number, z.number().int().min(1).max(100)).optional(),
    sortBy: z.enum(['startTime', 'createdAt', 'status']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    status: z.nativeEnum(ReservationStatus).optional(),
    staffId: idSchema(CUID_MESSAGE).optional(),
    customerProfileId: idSchema(CUID_MESSAGE).optional(),
    checkInCode: z.string().trim().min(1).max(10).optional(),
    search: z.string().trim().min(1).max(100).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  }),
});


// =================================
// Public Schemas
// =================================

export const createPublicReservationSchema = z.object({
  headers: z.object({
    'idempotency-key': z.string().min(16).max(128),
  }),
  params: z.object({
    gamingCenterSlug: z.string(),
  }),
  body: z.object({
    stationId: idSchema(CUID_MESSAGE),
    staffId: idSchema(CUID_MESSAGE),
    startTime: z.string().datetime(),
    durationHours: z.number().int().positive().max(24).optional(),
    customer: z.object({
      fullName: z.string().min(2),
      phone: z.string().min(10), // E.164 normalization will be handled in the station
      email: z.string().email().optional(),
    }),
    note: z.string().max(500).optional(),
    voucherCode: z.string().trim().optional(),
  }),
});


// = a single source of truth for types
export type CreateReservationInput = z.infer<typeof createReservationSchema>['body'];
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>['body'];
export type CancelReservationInput = z.infer<typeof cancelReservationSchema>['body'];
export type RescheduleReservationInput = z.infer<typeof rescheduleReservationSchema>['body'];
export type ProposeTimeInput = z.infer<typeof proposeTimeSchema>['body'];
export type ListReservationQuery = z.infer<typeof listReservationQuerySchema>['query'];
export type CreatePublicReservationInput = z.infer<typeof createPublicReservationSchema>['body'];
