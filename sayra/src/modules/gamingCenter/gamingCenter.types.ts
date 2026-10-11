import { z } from 'zod';
import { createGamingCenterSchema, updateGamingCenterSchema } from './gamingCenter.validation';

export type CreateGamingCenterInput = z.infer<typeof createGamingCenterSchema>;
export type UpdateGamingCenterInput = z.infer<typeof updateGamingCenterSchema>;
