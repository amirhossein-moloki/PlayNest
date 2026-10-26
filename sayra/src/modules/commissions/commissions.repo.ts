
import { Prisma, CommissionPaymentStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const CommissionsRepo = {
  // Policy operations
  async findPolicyByGamingCenterId(gamingCenterId: string, tx?: Prisma.TransactionClient) {
    const client = (tx && tx.commissionPolicy) ? tx : prisma;
    if (!client?.commissionPolicy?.findUnique) {
      return null;
    }
    try {
      return await client.commissionPolicy.findUnique({
        where: { gamingCenterId },
      });
    } catch {
      return null;
    }
  },

  async upsertPolicy(gamingCenterId: string, data: Prisma.CommissionPolicyCreateInput) {
    return prisma.commissionPolicy.upsert({
      where: { gamingCenterId },
      create: data,
      update: data,
    });
  },

  async findSettingsByGamingCenterId(gamingCenterId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.settings.findUnique({
      where: { gamingCenterId },
    });
  },

  async countTargetContributions(gamingCenterId: string, targetPeriod: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.earning.count({
      where: {
        gamingCenterId,
        targetPeriod,
        targetContribution: true,
      },
    });
  },

  async lockPolicyForUpdate(gamingCenterId: string, tx: Prisma.TransactionClient) {
    return tx.$executeRaw`SELECT "id" FROM "CommissionPolicy" WHERE "gamingCenterId" = ${gamingCenterId} FOR UPDATE`;
  },

  // Reservation Commission operations
  async findEarning(reservationId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.earning.findUnique({
      where: { reservationId },
    });
  },

  async createEarning(data: Prisma.EarningUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.earning.create({
      data,
    });
  },

  async updateEarning(id: string, gamingCenterId: string, data: Prisma.EarningUpdateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const result = await client.earning.updateMany({
      where: { id, gamingCenterId },
      data,
    });
    if (result.count === 0) return null;
    return client.earning.findUnique({ where: { id } });
  },

  async listEarnings(gamingCenterId: string, where: Prisma.EarningWhereInput, skip: number, take: number) {
    const [commissions, totalItems] = await prisma.$transaction([
      prisma.earning.findMany({
        where: { ...where, gamingCenterId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          reservation: {
            select: {
              id: true,
              startTime: true,
              stationSnapshot: true,
              customerProfile: {
                select: { displayName: true }
              }
            }
          }
        }
      }),
      prisma.earning.count({
        where: { ...where, gamingCenterId },
      }),
    ]);

    return { commissions, totalItems };
  },

  // Commission Payment operations
  async createEarningPayment(data: Prisma.EarningPaymentUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.earningPayment.create({
      data,
    });
  },

  async findEarningPayments(earningId: string, status?: CommissionPaymentStatus, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.earningPayment.findMany({
      where: { earningId, status },
    });
  },

  async findEarningWithPayments(id: string) {
    return prisma.earning.findUnique({
      where: { id },
      include: { payments: true },
    });
  },

  async findReservationForEarning(reservationId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.reservation.findUnique({
      where: { id: reservationId },
      include: {
        earning: true,
        payments: {
          where: { status: 'PAID' }
        }
      },
    });
  },

  async findCommissionById(id: string, gamingCenterId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.earning.findFirst({
      where: { id, gamingCenterId },
    });
  },

  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(fn);
  }
};
