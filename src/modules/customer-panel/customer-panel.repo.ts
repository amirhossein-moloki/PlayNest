import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const CustomerPanelRepo = {
  async findCustomerAccountById(id: string) {
    return prisma.customerAccount.findUnique({
      where: { id },
      include: {
        profiles: {
          include: {
            gamingCenter: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });
  },

  async findManyReservation(
    where: Prisma.ReservationWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.ReservationOrderByWithRelationInput = { startTime: 'desc' }
  ) {
    return prisma.reservation.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        gamingCenter: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        staff: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        station: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  async countReservation(where: Prisma.ReservationWhereInput) {
    return prisma.reservation.count({ where });
  },

  async findReservationById(id: string, customerAccountId: string) {
    return prisma.reservation.findFirst({
      where: {
        id,
        customerAccountId,
      },
      include: {
        gamingCenter: {
          include: {
            settings: true,
          },
        },
        staff: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        station: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  async updateReservation(id: string, customerAccountId: string, data: Prisma.ReservationUpdateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const result = await client.reservation.updateMany({
      where: { id, customerAccountId },
      data,
    });
    if (result.count === 0) return null;
    return client.reservation.findUnique({ where: { id } });
  },

  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(fn);
  },
};
