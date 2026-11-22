import { SessionActorType } from '@prisma/client';
import { addMinutes } from 'date-fns';
import { ClosuresRepo } from './closures.repo';
import {
  CloseForNextHoursInput,
  CreateClosureInput,
  GetClosuresQuery,
  MAX_TEMPORARY_CLOSURE_MINUTES,
  resolveClosureDurationMinutes,
} from './closures.validators';
import { auditService } from '../audit/audit.station';
import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

type AuditActor = { id: string; actorType: SessionActorType };
type AuditContext = { ip?: string; userAgent?: string };

async function assertGamingCenterExists(gamingCenterId: string) {
  const gamingCenter = await prisma.gamingCenter.findUnique({
    where: { id: gamingCenterId },
    select: { id: true },
  });

  if (!gamingCenter) {
    throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
  }
}

async function persistClosureAndCountReservations(params: {
  gamingCenterId: string;
  title?: string;
  reason?: string;
  startDate: Date;
  endDate: Date;
  totalMinutes: number;
  replaceActive: boolean;
  now: Date;
  auditAction: string;
  actor: AuditActor;
  context?: AuditContext;
  includeReplacedCountWhenFalse?: boolean;
}) {
  const {
    gamingCenterId,
    title,
    reason,
    startDate,
    endDate,
    totalMinutes,
    replaceActive,
    now,
    auditAction,
    actor,
    context,
    includeReplacedCountWhenFalse,
  } = params;

  let closure;
  let affectedReservationsCount = 0;
  let replacedClosures: Awaited<ReturnType<typeof ClosuresRepo.endActiveClosures>> = [];

  if (replaceActive || includeReplacedCountWhenFalse) {
    const txResult = await ClosuresRepo.transaction(async (tx) => {
      const replaced = replaceActive
        ? await ClosuresRepo.endActiveClosures(gamingCenterId, now, tx)
        : [];
      const created = await ClosuresRepo.createClosure(
        gamingCenterId,
        { title, reason, startDate, endDate },
        tx
      );
      const affectedCount = await ClosuresRepo.countOverlappingReservations(gamingCenterId, startDate, endDate, tx);
      return { created, replaced, affectedCount };
    });
    closure = txResult.created;
    replacedClosures = txResult.replaced;
    affectedReservationsCount = txResult.affectedCount;
  } else {
    closure = await ClosuresRepo.createClosure(gamingCenterId, {
      title,
      reason,
      startDate,
      endDate,
    });
    affectedReservationsCount = await ClosuresRepo.countOverlappingReservations(gamingCenterId, startDate, endDate);
  }

  await auditService.log(
    gamingCenterId,
    actor,
    auditAction,
    { name: 'GamingCenterClosure', id: closure.id },
    { old: replacedClosures.length > 0 ? replacedClosures : null, new: closure },
    context
  );

  const includeReplacedMeta = replaceActive || includeReplacedCountWhenFalse;
  const replacedMeta = includeReplacedMeta ? { replacedActiveClosuresCount: replacedClosures.length } : {};

  return {
    ...closure,
    durationHours: Number((totalMinutes / 60).toFixed(2)),
    durationMinutes: totalMinutes,
    affectedReservationsCount,
    ...replacedMeta,
  };
}

export const closuresStation = {
  async getClosures(gamingCenterId: string, filter?: GetClosuresQuery) {
    await assertGamingCenterExists(gamingCenterId);
    return ClosuresRepo.findClosuresByGamingCenterId(gamingCenterId, filter);
  },

  async getActiveClosureStatus(gamingCenterId: string, now: Date = new Date()) {
    await assertGamingCenterExists(gamingCenterId);

    const activeClosures = await ClosuresRepo.findActiveClosures(gamingCenterId, now);
    const primaryClosure = activeClosures[0] || null;
    const closedUntilDate = primaryClosure ? new Date(primaryClosure.endDate) : null;
    const remainingMinutes = closedUntilDate
      ? Math.max(0, Math.ceil((closedUntilDate.getTime() - now.getTime()) / 60000))
      : 0;

    return {
      isClosed: Boolean(primaryClosure),
      closedUntil: closedUntilDate ? closedUntilDate.toISOString() : null,
      remainingMinutes,
      activeClosures,
      primaryClosure,
    };
  },

  async getPublicActiveClosureStatus(gamingCenterSlug: string, now: Date = new Date()) {
    const gamingCenter = await prisma.gamingCenter.findFirst({
      where: {
        OR: [{ id: gamingCenterSlug }, { slug: gamingCenterSlug }],
      },
      select: { id: true, slug: true },
    });

    if (!gamingCenter) {
      throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
    }

    return this.getActiveClosureStatus(gamingCenter.id, now);
  },

  async closeForNextHours(
    gamingCenterId: string,
    data: CloseForNextHoursInput,
    actor: AuditActor,
    context?: AuditContext
  ) {
    await assertGamingCenterExists(gamingCenterId);

    const totalMinutes = resolveClosureDurationMinutes(data);
    if (!totalMinutes || !Number.isFinite(totalMinutes) || totalMinutes < 1 || totalMinutes > MAX_TEMPORARY_CLOSURE_MINUTES) {
      throw new AppError('Temporary closure duration must be between 1 minute and 168 hours.', httpStatus.BAD_REQUEST, {
        code: 'INVALID_CLOSURE_DURATION',
      });
    }

    const now = new Date();
    const startDate = now;
    const endDate = addMinutes(now, totalMinutes);
    const title = data.title?.trim() || 'Temporary booking closure';

    return persistClosureAndCountReservations({
      gamingCenterId,
      title,
      reason: data.reason,
      startDate,
      endDate,
      totalMinutes,
      replaceActive: Boolean(data.replaceActive),
      now,
      auditAction: 'CLOSURE_TEMPORARY_CREATE',
      actor,
      context,
      includeReplacedCountWhenFalse: true,
    });
  },

  async createClosure(
    gamingCenterId: string,
    data: CreateClosureInput,
    actor: AuditActor,
    context?: AuditContext
  ) {
    await assertGamingCenterExists(gamingCenterId);

    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let totalMinutes: number;
    let title = data.title;

    if (data.endDate) {
      if (!data.startDate) {
        throw new AppError('startDate is required when endDate is provided.', httpStatus.BAD_REQUEST, {
          code: 'INVALID_CLOSURE_RANGE',
        });
      }
      startDate = new Date(data.startDate);
      endDate = new Date(data.endDate);
      if (!(startDate < endDate)) {
        throw new AppError('startDate must be strictly before endDate', httpStatus.BAD_REQUEST, {
          code: 'INVALID_CLOSURE_RANGE',
        });
      }
      totalMinutes = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
    } else {
      const resolvedMinutes = resolveClosureDurationMinutes(data);
      if (
        !resolvedMinutes ||
        !Number.isFinite(resolvedMinutes) ||
        resolvedMinutes < 1 ||
        resolvedMinutes > MAX_TEMPORARY_CLOSURE_MINUTES
      ) {
        throw new AppError('Temporary closure duration must be between 1 minute and 168 hours.', httpStatus.BAD_REQUEST, {
          code: 'INVALID_CLOSURE_DURATION',
        });
      }
      totalMinutes = resolvedMinutes;
      startDate = data.startDate ? new Date(data.startDate) : now;
      endDate = addMinutes(startDate, totalMinutes);
      title = data.title?.trim() || 'Temporary booking closure';
    }

    return persistClosureAndCountReservations({
      gamingCenterId,
      title,
      reason: data.reason,
      startDate,
      endDate,
      totalMinutes,
      replaceActive: Boolean(data.replaceActive),
      now,
      auditAction: 'CLOSURE_CREATE',
      actor,
      context,
      includeReplacedCountWhenFalse: false,
    });
  },

  async reopenBookings(
    gamingCenterId: string,
    actor: AuditActor,
    context?: AuditContext
  ) {
    await assertGamingCenterExists(gamingCenterId);

    const now = new Date();
    const endedClosures = await ClosuresRepo.endActiveClosures(gamingCenterId, now);
    const endedClosureIds = endedClosures.map((c) => c.id);

    if (endedClosures.length > 0) {
      await auditService.log(
        gamingCenterId,
        actor,
        'CLOSURE_REOPEN',
        { name: 'GamingCenterClosure', id: endedClosureIds[0] },
        { old: endedClosures, new: { reopenedAt: now, endedClosureIds } },
        context
      );
    }

    return {
      reopened: endedClosures.length > 0,
      reopenedCount: endedClosures.length,
      reopenedAt: now.toISOString(),
      endedClosureIds,
    };
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

  async getPublicClosures(gamingCenterSlug: string, filter?: GetClosuresQuery) {
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
