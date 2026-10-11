import { z } from 'zod';
import { createMediaSchema, updateMediaSchema } from './media.validators';

export type CreateMediaInput = z.infer<typeof createMediaSchema>['body'];
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>['body'];

export type CreateMediaData = CreateMediaInput;
export type UpdateMediaData = UpdateMediaInput;
