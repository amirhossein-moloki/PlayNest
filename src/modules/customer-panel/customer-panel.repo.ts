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

  async findManyBookings(
    where: Prisma.BookingWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.BookingOrderByWithRelationInput = { startTime: 'desc' }
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

  async countBookings(where: Prisma.BookingWhereInput) {
    return prisma.reservation.count({ where });
  },

  async findBookingById(id: string, customerAccountId: string) {
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

  async updateBooking(id: string, data: Prisma.BookingUpdateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.reservation.update({
      where: { id },
      data,
    });
  },

  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(fn);
  },
};
