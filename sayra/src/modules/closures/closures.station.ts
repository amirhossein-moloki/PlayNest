import { SessionActorType } from '@prisma/client';
import { ClosuresRepo } from './closures.repo';
import { CreateClosureInput } from './closures.validators';
import { auditService } from '../audit/audit.station';
import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export const closuresStation = {
  async getClosures(gamingCenterId: string, filter?: { startDate?: string; endDate?: string }) {
    const gamingCenter = await prisma.gamingCenter.findUnique({
      where: { id: gamingCenterId },
      select: { id: true },
    });

    if (!gamingCenter) {
      throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
    }

    return ClosuresRepo.findClosuresByGamingCenterId(gamingCenterId, filter);
  },

  async createClosure(
    gamingCenterId: string,
    data: CreateClosureInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const gamingCenter = await prisma.gamingCenter.findUnique({
      where: { id: gamingCenterId },
    });

    if (!gamingCenter) {
      throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
    }

    const closure = await ClosuresRepo.createClosure(gamingCenterId, data);

    await auditService.log(
      gamingCenterId,
      actor,
      'CLOSURE_CREATE',
      { name: 'GamingCenterClosure', id: closure.id },
      { old: null, new: closure },
      context
    );

    return closure;
  },

  async deleteClosure(
    gamingCenterId: string,
    closureId: string,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await ClosuresRepo.findClosureById(gamingCenterId, closureId);
    if (!existing) {
      throw new AppError('Closure not found', httpStatus.NOT_FOUND);
    }

    await ClosuresRepo.deleteClosure(gamingCenterId, closureId);

    await auditService.log(
      gamingCenterId,
      actor,
      'CLOSURE_DELETE',
      { name: 'GamingCenterClosure', id: closureId },
      { old: existing, new: null },
      context
    );

    return { success: true };
  },

  async getPublicClosures(gamingCenterSlug: string, filter?: { startDate?: string; endDate?: string }) {
    const gamingCenter = await prisma.gamingCenter.findFirst({
      where: {
        OR: [{ id: gamingCenterSlug }, { slug: gamingCenterSlug }],
      },
      select: { id: true, slug: true },
    });

    if (!gamingCenter) {
      throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
    }

    return this.getClosures(gamingCenter.id, filter);
  },
};
