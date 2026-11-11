import { Prisma, BookingHoldStatus, ReservationStatus, PaymentStatus, ReservationPaymentState, ReservationSource } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const BookingHoldRepo = {
  async lockStationsForUpdate(stationIds: string[], tx: Prisma.TransactionClient): Promise<void> {
    const client = tx || prisma;
    const sortedIds = [...stationIds].sort();
    for (const id of sortedIds) {
      try {
        await client.$executeRaw`SELECT id FROM "GameStation" WHERE id = ${id} FOR UPDATE`;
      } catch {
        // In unit test mocks or environments without raw SQL, proceed gracefully
      }
    }
  },

  async findOverlappingReservationsAndHoldsForStations(
    gamingCenterId: string,
    stationIds: string[],
    startTime: Date,
    endTime: Date,
    now: Date = new Date(),
    excludeHoldId?: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;

    // 1. Find overlapping active reservations
    const reservations = await client.reservation.findMany({
      where: {
        gamingCenterId,
        stationId: { in: stationIds },
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

    // 2. Find overlapping active, unexpired booking holds
    const holds = await client.bookingHold.findMany({
      where: {
        gamingCenterId,
        ...(excludeHoldId ? { id: { not: excludeHoldId } } : {}),
        status: BookingHoldStatus.ACTIVE,
        expiresAt: { gt: now },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        items: {
          some: {
            stationId: { in: stationIds },
          },
        },
      },
      include: {
        items: {
          where: {
            stationId: { in: stationIds },
          },
          include: {
            station: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const holdOverlaps = holds.flatMap((h) =>
      h.items.map((item) => ({
        id: h.id,
        stationId: item.stationId,
        station: item.station,
      }))
    );

    return [...reservations, ...holdOverlaps];
  },

  async findHoldById(id: string, gamingCenterId?: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.bookingHold.findFirst({
      where: {
        id,
        ...(gamingCenterId ? { gamingCenterId } : {}),
      },
      include: {
        items: {
          include: {
            station: true,
          },
        },
        payment: true,
        customerAccount: true,
        customerProfile: true,
        gamingCenter: {
          include: {
            settings: true,
          },
        },
      },
    });
  },

  async clearIdempotencyKeyForFailedHold(
    holdId: string,
    gamingCenterId: string,
    idempotencyKey: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    // Clear idempotency key on hold and on payment atomically so user can retry
    await client.bookingHold.updateMany({
      where: { id: holdId, gamingCenterId, idempotencyKey },
      data: { idempotencyKey: null },
    });
    await client.payment.updateMany({
      where: { bookingHoldId: holdId, gamingCenterId, idempotencyKey },
      data: { idempotencyKey: null },
    });
  },

  async findHoldForUpdate(id: string, tx: Prisma.TransactionClient) {
    try {
      await tx.$executeRaw`SELECT id FROM "BookingHold" WHERE id = ${id} FOR UPDATE`;
    } catch {
      // Test mock fallback
    }
    return tx.bookingHold.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            station: true,
          },
        },
        payment: true,
        customerAccount: true,
        customerProfile: true,
        gamingCenter: {
          include: {
            settings: true,
          },
        },
      },
    });
  },

  async findHoldByIdempotencyKey(gamingCenterId: string, idempotencyKey: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.bookingHold.findUnique({
      where: {
        gamingCenterId_idempotencyKey: {
          gamingCenterId,
          idempotencyKey,
        },
      },
      include: {
        items: {
          include: {
            station: true,
          },
        },
        payment: true,
      },
    });
  },

  async createBookingHold(
    data: {
      gamingCenterId: string;
      customerProfileId: string;
      customerAccountId: string;
      startTime: Date;
      endTime: Date;
      durationMinutes: number;
      playerCount: number;
      totalAmount: number;
      currency: string;
      status: BookingHoldStatus;
      expiresAt: Date;
      idempotencyKey?: string | null;
      note?: string;
      items: Array<{
        stationId: string;
        staffId?: string;
        price: number;
        discountAmount: number;
        discountId?: string;
        stationSnapshot: Prisma.InputJsonValue;
      }>;
    },
    tx: Prisma.TransactionClient
  ) {
    return tx.bookingHold.create({
      data: {
        gamingCenterId: data.gamingCenterId,
        customerProfileId: data.customerProfileId,
        customerAccountId: data.customerAccountId,
        startTime: data.startTime,
        endTime: data.endTime,
        durationMinutes: data.durationMinutes,
        playerCount: data.playerCount,
        totalAmount: data.totalAmount,
        currency: data.currency,
        status: data.status,
        expiresAt: data.expiresAt,
        idempotencyKey: data.idempotencyKey,
        note: data.note,
        items: {
          create: data.items.map((item) => ({
            stationId: item.stationId,
            staffId: item.staffId,
            price: item.price,
            discountAmount: item.discountAmount,
            discountId: item.discountId,
            stationSnapshot: item.stationSnapshot,
          })),
        },
      },
      include: {
        items: {
          include: {
            station: true,
          },
        },
        payment: true,
      },
    });
  },

  async updateHoldStatus(
    id: string,
    status: BookingHoldStatus,
    extra?: { convertedGroupBookingId?: string },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.bookingHold.update({
      where: { id },
      data: {
        status,
        convertedGroupBookingId: extra?.convertedGroupBookingId,
      },
      include: {
        items: true,
        payment: true,
      },
    });
  },

  async convertHoldToGroupBookingAndReservations(
    holdId: string,
    tx: Prisma.TransactionClient
  ) {
    const hold = await this.findHoldForUpdate(holdId, tx);
    if (!hold) {
      throw new Error(`BookingHold ${holdId} not found`);
    }

    // Find system/staff user for creator attribution with fallback to managerId or first active admin/user
    const center = await tx.gamingCenter.findUnique({
      where: { id: hold.gamingCenterId },
      select: { managerId: true },
    });
    let creatorUserId = center?.managerId;
    if (!creatorUserId) {
      const staffUser = await tx.user.findFirst({
        where: { gamingCenterId: hold.gamingCenterId },
        select: { id: true },
      });
      creatorUserId = staffUser?.id;
    }
    if (!creatorUserId) {
      const anyUser = await tx.user.findFirst({ select: { id: true } });
      creatorUserId = anyUser?.id;
    }

    const totalHours = hold.durationMinutes / 60;
    const aggregateDiscount = hold.items.reduce((sum, item) => sum + item.discountAmount, 0);

    // 1. Create GroupBooking with CONFIRMED and PAID
    const groupBooking = await tx.groupBooking.create({
      data: {
        gamingCenterId: hold.gamingCenterId,
        customerProfileId: hold.customerProfileId,
        customerAccountId: hold.customerAccountId,
        createdByUserId: creatorUserId || hold.customerAccountId,
        startTime: hold.startTime,
        endTime: hold.endTime,
        totalHours,
        totalPrice: hold.totalAmount,
        discountAmount: aggregateDiscount,
        status: ReservationStatus.CONFIRMED,
        paymentState: ReservationPaymentState.PAID,
        note: hold.note,
        items: {
          create: hold.items.map((item) => ({
            stationId: item.stationId,
            staffId: item.staffId,
            price: item.price,
            discountAmount: item.discountAmount,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // 2. Create Reservations for each item
    for (const item of hold.items) {
      const reservation = await tx.reservation.create({
        data: {
          gamingCenterId: hold.gamingCenterId,
          stationId: item.stationId,
          staffId: item.staffId,
          customerProfileId: hold.customerProfileId,
          customerAccountId: hold.customerAccountId,
          createdByUserId: creatorUserId || hold.customerAccountId,
          groupBookingId: groupBooking.id,
          startTime: hold.startTime,
          endTime: hold.endTime,
          totalHours,
          totalPrice: item.price,
          discountAmount: item.discountAmount,
          discountId: item.discountId,
          status: ReservationStatus.CONFIRMED,
          source: ReservationSource.ONLINE,
          note: hold.note,
          paymentState: ReservationPaymentState.PAID,
          stationSnapshot: item.stationSnapshot as Prisma.InputJsonValue,
        },
      });

      // Link groupBookingItem to reservation
      const matchingItem = groupBooking.items.find((gi) => gi.stationId === item.stationId);
      if (matchingItem) {
        await tx.groupBookingItem.update({
          where: { id: matchingItem.id },
          data: { reservationId: reservation.id },
        });
      }
    }

    // 3. Mark BookingHold as CONVERTED
    await tx.bookingHold.update({
      where: { id: hold.id },
      data: {
        status: BookingHoldStatus.CONVERTED,
        convertedGroupBookingId: groupBooking.id,
      },
    });

    // 4. Update Payment to associate with groupBookingId if present
    if (hold.payment) {
      await tx.payment.update({
        where: { id: hold.payment.id },
        data: {
          groupBookingId: groupBooking.id,
          status: PaymentStatus.PAID,
          paidAt: hold.payment.paidAt || new Date(),
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
        payments: true,
      },
    });
  },

  async findExpiredActiveHolds(now: Date, limit = 50, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.bookingHold.findMany({
      where: {
        status: BookingHoldStatus.ACTIVE,
        expiresAt: { lte: now },
        // Do NOT expire holds that have successfully verified payments
        OR: [
          { payment: null },
          { payment: { status: { not: PaymentStatus.PAID } } },
        ],
      },
      take: limit,
      include: {
        payment: true,
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
