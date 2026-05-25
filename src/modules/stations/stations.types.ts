import { z } from 'zod';
import { createServiceSchema, updateServiceSchema } from './stations.validators';

// Type for the body of the create station request
export type CreateServiceInput = z.infer<typeof createServiceSchema>['body'];

// Type for the body of the update station request
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>['body'];
