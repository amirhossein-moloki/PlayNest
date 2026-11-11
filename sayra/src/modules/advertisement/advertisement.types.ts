import { AdvertisementRequestStatus, MediaType } from '@prisma/client';

export interface CreateAdvertisementDto {
  title: string;
  description?: string;
  bannerUrl: string;
  destinationUrl?: string;
  mediaType?: MediaType;
  mediaId?: string;
  proposedDurationDays?: number;
}

export interface UpdateAdvertisementDto {
  title?: string;
  description?: string;
  bannerUrl?: string;
  destinationUrl?: string;
  mediaType?: MediaType;
  mediaId?: string;
  proposedDurationDays?: number;
}

export interface AdvertisementResponse {
  id: string;
  title: string;
  description: string | null;
  bannerUrl: string;
  mediaType: MediaType;
  destinationUrl: string | null;
  proposedDurationDays: number;
  durationDays: number;
  priority: number;
  startDate: Date | null;
  endDate: Date | null;
  status: AdvertisementRequestStatus;
  decisionReason: string | null;
  adminNote: string | null;
  gamingCenterId: string;
  ownerId: string;
  remainingDays: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
