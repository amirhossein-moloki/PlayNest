import { WaitlistStatus, WaitlistOfferStatus } from '@prisma/client';

export interface CreateWaitlistEntryInput {
  stationId: string;
  startTime: string | Date;
  endTime: string | Date;
  note?: string;
  customer?: {
    fullName: string;
    phone: string;
    email?: string;
  };
}

export interface ListWaitlistQuery {
  page?: number;
  pageSize?: number;
  status?: WaitlistStatus;
  stationId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ListWaitlistOffersQuery {
  page?: number;
  pageSize?: number;
  status?: WaitlistOfferStatus;
  stationId?: string;
}
