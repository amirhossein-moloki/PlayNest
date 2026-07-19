import { prisma } from '../../config/prisma';
import { ReactionType, Reaction, Prisma } from '@prisma/client';

export interface ToggleReactionResult {
  action: 'created' | 'updated' | 'removed';
  reaction: Reaction;
  oldType?: ReactionType;
}

export const reactionsRepository = {
  async findUserReaction(gamingCenterId: string, userId: string, contentType: string, objectId: string) {
    return prisma.reaction.findFirst({
      where: {
        gamingCenterId,
        userId,
        contentType,
        objectId,
      },
    });
  },

  async toggleReaction(
    gamingCenterId: string,
    userId: string,
    contentType: string,
    objectId: string,
    type: ReactionType
  ): Promise<ToggleReactionResult> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.reaction.findUnique({
        where: {
          userId_contentType_objectId: {
            userId,
            contentType,
            objectId,
          },
        },
      });

      if (existing && existing.gamingCenterId !== gamingCenterId) {
        throw new Error('Tenant mismatch');
      }

      if (existing) {
        if (existing.type === type) {
          // Remove reaction
          await tx.reaction.delete({ where: { id: existing.id } });
          await this.updateAggregate(tx, gamingCenterId, contentType, objectId, type, -1);
          return { action: 'removed', reaction: existing };
        } else {
          // Change reaction type
          const oldType = existing.type;
          const updated = await tx.reaction.update({
            where: { id: existing.id },
            data: { type },
          });
          await this.updateAggregate(tx, gamingCenterId, contentType, objectId, oldType, -1);
          await this.updateAggregate(tx, gamingCenterId, contentType, objectId, type, 1);
          return { action: 'updated', reaction: updated, oldType };
        }
      } else {
        // Create new reaction
        const created = await tx.reaction.create({
          data: {
            gamingCenterId,
            userId,
            contentType,
            objectId,
            type,
          },
        });
        await this.updateAggregate(tx, gamingCenterId, contentType, objectId, type, 1);
        return { action: 'created', reaction: created };
      }
    });
  },

  async updateAggregate(
    tx: Prisma.TransactionClient,
    gamingCenterId: string,
    contentType: string,
    objectId: string,
    type: ReactionType,
    increment: number
  ) {
    return tx.reactionAggregate.upsert({
      where: {
        contentType_objectId_type: {
          contentType,
          objectId,
          type,
        },
      },
      update: {
        count: { increment },
      },
      create: {
        gamingCenterId,
        contentType,
        objectId,
        type,
        count: increment > 0 ? increment : 0,
      },
    });
  },

  async getAggregates(gamingCenterId: string, contentType: string, objectId: string) {
    const aggregates = await prisma.reactionAggregate.findMany({
      where: { gamingCenterId, contentType, objectId },
    });

    const result: Record<string, number> = {};
    aggregates.forEach((agg) => {
      result[agg.type] = agg.count;
    });

    return result;
  },
};
