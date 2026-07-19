import { ReactionType } from '@prisma/client';

export interface ToggleReactionDto {
  contentType: string;
  objectId: string;
  type: ReactionType;
}

export interface ReactionResponse {
  id: string;
  userId: string;
  type: ReactionType;
  contentType: string;
  objectId: string;
}

export interface ReactionAggregatesResponse {
  [type: string]: number;
}
