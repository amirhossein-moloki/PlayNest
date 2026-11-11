import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ScheduleItem } from './schedules.validators';

export const SchedulesRepo = {
  async getSchedulesByGamingCenterId(gamingCenterId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenterSchedule.findMany({
      where: { gamingCenterId },
      orderBy: { dayOfWeek: 'asc' },
    });
  },

  async upsertSchedules(
    gamingCenterId: string,
    schedules: ScheduleItem[],
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const upsertPromises = schedules.map((item) =>
      client.gamingCenterSchedule.upsert({
        where: {
          gamingCenterId_dayOfWeek: {
            gamingCenterId,
            dayOfWeek: item.dayOfWeek,
          },
        },
        update: {
          startTime: item.isClosed ? null : item.startTime,
          endTime: item.isClosed ? null : item.endTime,
          isClosed: item.isClosed,
        },
        create: {
          gamingCenterId,
          dayOfWeek: item.dayOfWeek,
          startTime: item.isClosed ? null : item.startTime,
          endTime: item.isClosed ? null : item.endTime,
          isClosed: item.isClosed,
        },
      })
    );

    return Promise.all(upsertPromises);
  },

  async deleteSchedule(gamingCenterId: string, dayOfWeek: number, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenterSchedule.deleteMany({
      where: { gamingCenterId, dayOfWeek },
    });
  },
};
