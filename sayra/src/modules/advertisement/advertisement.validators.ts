import { z } from 'zod';
import { AdvertisementRequestStatus, MediaType } from '@prisma/client';

export const createAdvertisementSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150, 'Title too long'),
  description: z.string().trim().max(1000).optional(),
  bannerUrl: z.string().trim().min(1, 'Banner URL is required'),
  destinationUrl: z.string().trim().url('Invalid destination URL').optional().or(z.literal('')),
  mediaType: z.nativeEnum(MediaType).optional().default(MediaType.IMAGE),
  mediaId: z.string().trim().optional(),
  proposedDurationDays: z.coerce.number().int().min(1, 'Duration must be at least 1 day').max(365, 'Duration cannot exceed 365 days').optional().default(30),
});

export type CreateAdvertisementInput = {
  title: string;
  bannerUrl: string;
  description?: string;
  destinationUrl?: string;
  mediaType?: MediaType;
  mediaId?: string;
  proposedDurationDays?: number;
};

export const updateAdvertisementSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150, 'Title too long').optional(),
  description: z.string().trim().max(1000).optional(),
  bannerUrl: z.string().trim().min(1).optional(),
  destinationUrl: z.string().trim().url('Invalid destination URL').optional().or(z.literal('')),
  mediaType: z.nativeEnum(MediaType).optional(),
  mediaId: z.string().trim().optional(),
  proposedDurationDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const listAdvertisementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.nativeEnum(AdvertisementRequestStatus).optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(['createdAt', 'startDate', 'endDate', 'priority', 'status']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional().default('desc'),
});
