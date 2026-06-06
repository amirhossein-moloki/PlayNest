import { z } from 'zod';
import { createStationSchema, updateStationSchema } from './station.validator';

// Type for the body of the create station request
export type CreateStationInput = z.infer<typeof createStationSchema>['body'];

// Type for the body of the update station request
export type UpdateStationInput = z.infer<typeof updateStationSchema>['body'];
