import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const AuditRepo = {
  async createLog(data: Prisma.AuditLogUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.auditLog.create({ data });
  },

  async findManyLogs(where: Prisma.AuditLogWhereInput, skip: number, take: number, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  },

  async countLogs(where: Prisma.AuditLogWhereInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.auditLog.count({ where });
  },

  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(fn);
  }
};
