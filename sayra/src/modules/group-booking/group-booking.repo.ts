import { Prisma, ReservationStatus, ReservationPaymentState, ReservationSource } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const GroupBookingRepo = {
  async findStationsBatch(stationIds: string[], gamingCenterId: string, isActive?: boolean, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gameStation.findMany({
      where: {
        id: { in: stationIds },
        gamingCenterId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
  },

  async findOverlappingReservationsForStations(
    gamingCenterId: string,
    stationIds: string[],
    startTime: Date,
    endTime: Date,
    excludeGroupBookingId?: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.reservation.findMany({
      where: {
        gamingCenterId,
        stationId: { in: stationIds },
        ...(excludeGroupBookingId ? { groupBookingId: { not: excludeGroupBookingId } } : {}),
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED, ReservationStatus.IN_PROGRESS] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: {
        id: true,
        stationId: true,
        station: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  async findGroupBookingById(id: string, gamingCenterId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.groupBooking.findFirst({
      where: { id, gamingCenterId },
      include: {
        items: {
          include: {
            station: true,
            reservation: true,
          },
        },
        reservations: true,
        customerAccount: true,
        customerProfile: true,
        createdBy: {
          select: { id: true, fullName: true, role: true },
        },
        payments: true,
      },
    });
  },

  async findManyGroupBookings(
    where: Prisma.GroupBookingWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.GroupBookingOrderByWithRelationInput | Prisma.GroupBookingOrderByWithRelationInput[],
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.groupBooking.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        items: {
          include: {
            station: true,
          },
        },
        reservations: true,
        customerAccount: true,
        customerProfile: true,
      },
    });
  },

  async countGroupBookings(where: Prisma.GroupBookingWhereInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.groupBooking.count({ where });
  },

  async createGroupBookingWithDetails(
    data: {
      gamingCenterId: string;
      customerProfileId: string;
      customerAccountId: string;
      createdByUserId: string;
      startTime: Date;
      endTime: Date;
      totalHours: number;
      totalPrice: number;
      discountAmount: number;
      status: ReservationStatus;
      paymentState: ReservationPaymentState;
      source?: ReservationSource;
      note?: string;
      items: Array<{
        stationId: string;
        staffId?: string;
        price: number;
        discountAmount: number;
        discountId?: string;
        stationSnapshot: {
          name: string;
          hourlyPrice: number;
          stationType: string;
        };
      }>;
    },
    tx: Prisma.TransactionClient
  ) {
    // 1. Create GroupBooking
    const groupBooking = await tx.groupBooking.create({
      data: {
        gamingCenterId: data.gamingCenterId,
        customerProfileId: data.customerProfileId,
        customerAccountId: data.customerAccountId,
        createdByUserId: data.createdByUserId,
        startTime: data.startTime,
        endTime: data.endTime,
        totalHours: data.totalHours,
        totalPrice: data.totalPrice,
        discountAmount: data.discountAmount,
        status: data.status,
        paymentState: data.paymentState,
        note: data.note,
      },
    });

    // 2. For each item, create Reservation & GroupBookingItem
    for (const item of data.items) {
      const reservation = await tx.reservation.create({
        data: {
          gamingCenterId: data.gamingCenterId,
          stationId: item.stationId,
          staffId: item.staffId,
          customerProfileId: data.customerProfileId,
          customerAccountId: data.customerAccountId,
          createdByUserId: data.createdByUserId,
          groupBookingId: groupBooking.id,
          startTime: data.startTime,
          endTime: data.endTime,
          totalHours: data.totalHours,
          totalPrice: item.price,
          discountAmount: item.discountAmount,
          discountId: item.discountId,
          status: data.status,
          source: data.source || ReservationSource.WALK_IN,
          note: data.note,
          paymentState: data.paymentState,
          stationSnapshot: item.stationSnapshot as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.groupBookingItem.create({
        data: {
          groupBookingId: groupBooking.id,
          stationId: item.stationId,
          staffId: item.staffId,
          reservationId: reservation.id,
          price: item.price,
          discountAmount: item.discountAmount,
        },
      });
    }

    return tx.groupBooking.findUnique({
      where: { id: groupBooking.id },
      include: {
        items: {
          include: {
            station: true,
            reservation: true,
          },
        },
        reservations: true,
        customerAccount: true,
        customerProfile: true,
        createdBy: {
          select: { id: true, fullName: true, role: true },
        },
        payments: true,
      },
    });
  },

  async updateGroupBookingStatus(
    id: string,
    gamingCenterId: string,
    data: Prisma.GroupBookingUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    await client.groupBooking.updateMany({
      where: { id, gamingCenterId },
      data,
    });
    return client.groupBooking.findFirst({
      where: { id, gamingCenterId },
      include: {
        items: {
          include: {
            station: true,
            reservation: true,
          },
        },
        reservations: true,
        customerAccount: true,
        customerProfile: true,
      },
    });
  },

  async cancelGroupBookingAndReservations(
    id: string,
    gamingCenterId: string,
    canceledByUserId: string,
    reason?: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const now = new Date();

    // Update GroupBooking
    await client.groupBooking.updateMany({
      where: { id, gamingCenterId },
      data: {
        status: ReservationStatus.CANCELED,
        canceledAt: now,
        cancelReason: reason,
        canceledByUserId,
      },
    });

    // Update associated Reservations
    await client.reservation.updateMany({
      where: { groupBookingId: id, gamingCenterId },
      data: {
        status: ReservationStatus.CANCELED,
        canceledAt: now,
        cancelReason: reason,
        canceledByUserId,
      },
    });

    return client.groupBooking.findFirst({
      where: { id, gamingCenterId },
      include: {
        items: {
          include: {
            station: true,
            reservation: true,
          },
        },
        reservations: true,
        customerAccount: true,
        customerProfile: true,
      },
    });
  },

  async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel }
  ) {
    return prisma.$transaction(fn, options);
  },
};
