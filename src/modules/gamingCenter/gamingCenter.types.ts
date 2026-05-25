import { z } from 'zod';
import { createSalonSchema, updateSalonSchema } from './gamingCenter.validation';

export type CreateSalonInput = z.infer<typeof createSalonSchema>;
export type UpdateSalonInput = z.infer<typeof updateSalonSchema>;
