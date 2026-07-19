import { z } from 'zod';
import { ReactionType } from '@prisma/client';

export const toggleReactionSchema = z.object({
  contentType: z.enum(['post', 'comment']),
  objectId: z.string().cuid(),
  type: z.nativeEnum(ReactionType),
});
