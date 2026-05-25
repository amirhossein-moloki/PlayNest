
import { Prisma, CommissionPaymentStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const CommissionsRepo = {
  // Policy operations
  async findPolicyBySalonId(gamingCenterId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.commissionPolicy.findUnique({
      where: { gamingCenterId },
    });
  },

  async upsertPolicy(gamingCenterId: string, data: Prisma.SalonCommissionPolicyCreateInput) {
    return prisma.commissionPolicy.upsert({
      where: { gamingCenterId },
      create: data,
      update: data,
    });
  },

  // Reservation Commission operations
  async findBookingCommission(reservationId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.earning.findUnique({
      where: { reservationId },
    });
  },

  async createBookingCommission(data: Prisma.BookingCommissionUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.earning.create({
      data,
    });
  },

  async updateBookingCommission(id: string, data: Prisma.BookingCommissionUpdateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.earning.update({
      where: { id },
      data,
    });
  },

  async listCommissions(gamingCenterId: string, where: Prisma.BookingCommissionWhereInput, skip: number, take: number) {
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
              (stationSnapshot as any): true,
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
  async createCommissionPayment(data: Prisma.CommissionPaymentUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.earningPayment.create({
      data,
    });
  },

  async findCommissionPayments(earningId: string, status?: CommissionPaymentStatus, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.earningPayment.findMany({
      where: { earningId, status },
    });
  },

  async findCommissionWithPayments(id: string) {
    return prisma.earning.findUnique({
      where: { id },
      include: { payments: true },
    });
  },

  async findBookingForCommission(reservationId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.reservation.findUnique({
      where: { id: reservationId },
      include: {
        commission: true,
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
