import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { CreateClosureInput } from './closures.validators';

export const ClosuresRepo = {
  async findClosuresByGamingCenterId(
    gamingCenterId: string,
    filter?: { startDate?: string; endDate?: string },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const where: Prisma.GamingCenterClosureWhereInput = {
      gamingCenterId,
      ...(filter?.startDate || filter?.endDate
        ? {
          startDate: filter.endDate ? { lte: new Date(filter.endDate) } : undefined,
          endDate: filter.startDate ? { gte: new Date(filter.startDate) } : undefined,
        }
        : {}),
    };

    return client.gamingCenterClosure.findMany({
      where,
      orderBy: { startDate: 'asc' },
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
    data: CreateClosureInput,
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
