import { z } from 'zod';
import { WaitlistStatus, WaitlistOfferStatus } from '@prisma/client';

export const createWaitlistEntrySchema = z.object({
  body: z.object({
    stationId: z.string().min(1, 'Station ID is required'),
    startTime: z.string().datetime({ message: 'Invalid start time' }),
    endTime: z.string().datetime({ message: 'Invalid end time' }),
    note: z.string().optional(),
    customer: z.object({
      fullName: z.string().min(1, 'Full name is required'),
      phone: z.string().min(1, 'Phone number is required'),
      email: z.string().email('Invalid email').optional(),
    }).optional(),
  }).refine((data) => new Date(data.startTime) < new Date(data.endTime), {
    message: 'Start time must be before end time',
    path: ['endTime'],
  }),
});

export const listWaitlistQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    status: z.nativeEnum(WaitlistStatus).optional(),
    stationId: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
});

export const listWaitlistOffersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    status: z.nativeEnum(WaitlistOfferStatus).optional(),
    stationId: z.string().optional(),
  }),
});

export const cancelWaitlistEntrySchema = z.object({
  params: z.object({
    entryId: z.string().min(1),
  }),
  body: z.object({
    reason: z.string().optional(),
  }).optional(),
});

export const offerActionSchema = z.object({
  params: z.object({
    offerId: z.string().min(1),
  }),
});
