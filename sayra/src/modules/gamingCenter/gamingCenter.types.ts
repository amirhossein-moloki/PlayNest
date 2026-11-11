import { z } from 'zod';
import { Address } from '@prisma/client';
import { createGamingCenterSchema, updateGamingCenterSchema } from './gamingCenter.validation';

export type CreateGamingCenterInput = z.infer<typeof createGamingCenterSchema>;
export type UpdateGamingCenterInput = z.infer<typeof updateGamingCenterSchema>;

export interface DeviceTypeCounts {
  PC: number;
  PLAYSTATION: number;
  XBOX: number;
  SWITCH: number;
  VR: number;
}

export interface GamingCenterPricing {
  originalPrice: number;
  discountPercentage: number;
  discountAmount: number;
  finalPrice: number;
  hasDiscount: boolean;
}

export interface GamingCenterListItem {
  id: string;
  name: string;
  isActive: boolean;
  slug: string;
  description: string | null;
  pcCount: number;
  consoleCount: number;
  ps4: boolean;
  ps5: boolean;
  pc: boolean;
  xbox: boolean;
  is_open: boolean;
  hourlyRate: number;
  raiting: number;
  comment_count: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  addresses: Address[];
  hasDiscount: boolean;
  has_discount: boolean;
  coverImages: string[];
  coverImageUrl: string | null;
  banner: string | null;
  pricing: GamingCenterPricing;
  cancellationHours?: number;
  deviceCounts?: DeviceTypeCounts;
  owner?: {
    id: string;
    fullName: string;
    role: string;
    type: 'USER' | 'PLATFORM_ADMIN';
  } | null;
}
