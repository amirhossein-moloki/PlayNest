import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { GetClosuresQuery } from './closures.validators';

export const ClosuresRepo = {
  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  },

  async findClosuresByGamingCenterId(
    gamingCenterId: string,
    filter?: GetClosuresQuery,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const now = new Date();
    const andConditions: Prisma.GamingCenterClosureWhereInput[] = [];

    if (filter?.activeOnly) {
      andConditions.push({
        startDate: { lte: now },
        endDate: { gt: now },
      });
    } else if (filter?.upcomingOnly) {
      andConditions.push({
        endDate: { gt: now },
      });
    }

    if (filter?.endDate) {
      andConditions.push({
        startDate: { lte: new Date(filter.endDate) },
      });
    }

    if (filter?.startDate) {
      andConditions.push({
        endDate: { gte: new Date(filter.startDate) },
      });
    }

    const where: Prisma.GamingCenterClosureWhereInput = {
      gamingCenterId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    return client.gamingCenterClosure.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
  },

  async findActiveClosures(
    gamingCenterId: string,
    now: Date = new Date(),
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.gamingCenterClosure.findMany({
      where: {
        gamingCenterId,
        startDate: { lte: now },
        endDate: { gt: now },
      },
      orderBy: { endDate: 'desc' },
    });
  },

  async endActiveClosures(
    gamingCenterId: string,
    now: Date = new Date(),
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const activeClosures = await this.findActiveClosures(gamingCenterId, now, client);
    if (activeClosures.length === 0) {
      return [];
    }

    await client.gamingCenterClosure.updateMany({
      where: {
        id: { in: activeClosures.map((c) => c.id) },
        gamingCenterId,
      },
      data: {
        endDate: now,
      },
    });

    return activeClosures;
  },

  async countOverlappingReservations(
    gamingCenterId: string,
    startDate: Date,
    endDate: Date,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx || prisma;
    if (typeof client.reservation?.count !== 'function') {
      return 0;
    }

    return client.reservation.count({
      where: {
        gamingCenterId,
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
        startTime: { lt: endDate },
        endTime: { gt: startDate },
      },
    });
  },

  async findOverlappingClosures(
    gamingCenterId: string,
    startTime: Date,
    endTime: Date,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.gamingCenterClosure.findMany({
      where: {
        gamingCenterId,
        startDate: { lt: endTime },
        endDate: { gt: startTime },
      },
      select: {
        id: true,
        title: true,
        reason: true,
        startDate: true,
        endDate: true,
      },
    });
  },

  async createClosure(
    gamingCenterId: string,
    data: {
      title?: string;
      reason?: string;
      startDate: Date | string;
      endDate: Date | string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.gamingCenterClosure.create({
      data: {
        gamingCenterId,
        title: data.title,
        reason: data.reason,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
    });
  },

  async deleteClosure(
    gamingCenterId: string,
    closureId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.gamingCenterClosure.deleteMany({
      where: {
        id: closureId,
        gamingCenterId,
      },
    });
  },

  async findClosureById(
    gamingCenterId: string,
    closureId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.gamingCenterClosure.findFirst({
      where: {
        id: closureId,
        gamingCenterId,
      },
    });
  },
};
