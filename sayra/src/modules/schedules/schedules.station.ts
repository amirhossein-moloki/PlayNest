import { SessionActorType } from '@prisma/client';
import { SchedulesRepo } from './schedules.repo';
import { ScheduleItem } from './schedules.validators';
import { auditService } from '../audit/audit.station';
import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export const schedulesStation = {
  async getSchedules(gamingCenterId: string) {
    const gamingCenter = await prisma.gamingCenter.findUnique({
      where: { id: gamingCenterId },
      select: {
        id: true,
        name: true,
        openingTime: true,
        closingTime: true,
        closedDays: true,
        timezone: true,
        isActive: true,
      },
    });

    if (!gamingCenter) {
      throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
    }

    const customSchedules = await SchedulesRepo.getSchedulesByGamingCenterId(gamingCenterId);

    // Fallback to gaming center defaults if custom day schedule not set
    const allDays = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
      const custom = customSchedules.find((s) => s.dayOfWeek === dayOfWeek);
      if (custom) {
        return custom;
      }

      const isClosed = gamingCenter.closedDays.includes(dayOfWeek);
      return {
        id: `default-${gamingCenterId}-${dayOfWeek}`,
        gamingCenterId,
        dayOfWeek,
        startTime: isClosed ? null : (gamingCenter.openingTime || '09:00'),
        endTime: isClosed ? null : (gamingCenter.closingTime || '23:00'),
        isClosed,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    return {
      gamingCenterId,
      schedules: allDays,
    };
  },

  async updateSchedules(
    gamingCenterId: string,
    schedules: ScheduleItem[],
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const gamingCenter = await prisma.gamingCenter.findUnique({
      where: { id: gamingCenterId },
    });

    if (!gamingCenter) {
      throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
    }

    const oldSchedules = await SchedulesRepo.getSchedulesByGamingCenterId(gamingCenterId);
    const updated = await SchedulesRepo.upsertSchedules(gamingCenterId, schedules);

    await auditService.log(
      gamingCenterId,
      actor,
      'SCHEDULES_UPDATE',
      { name: 'GamingCenterSchedule', id: gamingCenterId },
      { old: oldSchedules, new: updated },
      context
    );

    return updated;
  },

  async getPublicSchedules(gamingCenterSlug: string) {
    const gamingCenter = await prisma.gamingCenter.findFirst({
      where: {
        OR: [{ id: gamingCenterSlug }, { slug: gamingCenterSlug }],
      },
      select: { id: true, slug: true, isActive: true },
    });

    if (!gamingCenter) {
      throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
    }

    return this.getSchedules(gamingCenter.id);
  },
};
