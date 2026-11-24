import { AdvertisementRequestStatus, AdvertisementType, MediaType } from '@prisma/client';

export interface CreateAdvertisementDto {
  title: string;
  description?: string;
  bannerUrl: string;
  destinationUrl?: string;
  mediaType?: MediaType;
  mediaId?: string;
  proposedDurationDays?: number;
  shortLinkId?: string | null;
  autoCreateShortLink?: boolean;
}

export interface UpdateAdvertisementDto {
  title?: string;
  description?: string;
  bannerUrl?: string;
  destinationUrl?: string;
  mediaType?: MediaType;
  mediaId?: string;
  proposedDurationDays?: number;
  shortLinkId?: string | null;
}

export interface AdvertisementResponse {
  id: string;
  title: string;
  description: string | null;
  bannerUrl: string;
  mediaType: MediaType;
  adType?: AdvertisementType;
  category?: string | null;
  destinationUrl: string | null;
  shortLinkId?: string | null;
  shortUrl?: string | null;
  proposedDurationDays: number;
  durationDays: number;
  priority: number;
  startDate: Date | null;
  endDate: Date | null;
  status: AdvertisementRequestStatus;
  decisionReason: string | null;
  adminNote: string | null;
  gamingCenterId: string | null;
  ownerId: string | null;
  remainingDays: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
