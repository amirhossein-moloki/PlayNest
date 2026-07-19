import { SessionActorType } from '@prisma/client';
import { reactionsRepository } from './reactions.repository';
import { ToggleReactionDto } from './reactions.types';
import { auditService } from '../audit/audit.station';
import { eventEmitter, AppEvents } from '../../common/events/event-emitter';

export const reactionsStation = {
  async toggleReaction(gamingCenterId: string, userId: string, data: ToggleReactionDto) {
    const { action, reaction, oldType } = await reactionsRepository.toggleReaction(
      gamingCenterId,
      userId,
      data.contentType,
      data.objectId,
      data.type
    );

    const actor = { id: userId, actorType: SessionActorType.USER };
    const entity = { name: 'Reaction', id: reaction.id };

    if (action === 'created') {
      await auditService.log(gamingCenterId, actor, 'REACTION_CREATE', entity, { new: reaction });
      eventEmitter.emit(AppEvents.REACTION_CREATED, { gamingCenterId, reaction });
    } else if (action === 'updated') {
      await auditService.log(gamingCenterId, actor, 'REACTION_UPDATE', entity, {
        old: { type: oldType },
        new: { type: reaction.type },
      });
      eventEmitter.emit(AppEvents.REACTION_UPDATED, { gamingCenterId, reaction, oldType });
    } else if (action === 'removed') {
      await auditService.log(gamingCenterId, actor, 'REACTION_DELETE', entity, { old: reaction });
      eventEmitter.emit(AppEvents.REACTION_REMOVED, { gamingCenterId, reaction });
    }

    return { action, reaction };
  },

  async getAggregates(gamingCenterId: string, contentType: string, objectId: string) {
    return reactionsRepository.getAggregates(gamingCenterId, contentType, objectId);
  },
};
