import { z } from 'zod';
import { Address } from '@prisma/client';
import { createGamingCenterSchema, updateGamingCenterSchema } from './gamingCenter.validation';

export type CreateGamingCenterInput = z.infer<typeof createGamingCenterSchema>;
export type UpdateGamingCenterInput = z.infer<typeof updateGamingCenterSchema>;

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
}
