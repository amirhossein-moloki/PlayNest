import { prisma } from '../../config/prisma';

export interface FindStationOptions {
  gamingCenterId?: string;
  windowStart?: Date;
  windowEnd?: Date;
  now?: Date;
}

export const AvailabilityRepo = {
  async findStationWithGamingCenter(
    stationId: string,
    gamingCenterSlug: string,
    options?: FindStationOptions
  ) {
    const now = options?.now ?? new Date();
    return prisma.gameStation.findFirst({
      where: {
        id: stationId,
        isActive: true,
        ...(options?.gamingCenterId
          ? { gamingCenterId: options.gamingCenterId }
          : { gamingCenter: { slug: gamingCenterSlug } }),
      },
      include: {
        gamingCenter: {
          include: {
            settings: true,
            schedules: true,
            closures: options
              ? {
                  where: {
                    OR: [
                      ...(options.windowStart && options.windowEnd
                        ? [{ startDate: { lt: options.windowEnd }, endDate: { gt: options.windowStart } }]
                        : []),
                      {
                        startDate: { lte: now },
                        endDate: { gt: now },
                      },
                    ],
                  },
                  orderBy: { endDate: 'desc' },
                }
              : true,
          },
        },
      },
    });
  },

  async findStaff(staffId: string, gamingCenterId: string, stationId: string) {
    return prisma.user.findFirst({
      where: {
        id: staffId,
        gamingCenterId,
        isActive: true,
        stationSkills: { some: { stationId } },
      },
      select: {
        id: true,
        fullName: true,
      },
    });
  },

  async findStaffList(gamingCenterId: string, stationId: string) {
    return prisma.user.findMany({
      where: {
        gamingCenterId,
        stationSkills: { some: { stationId } },
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
      },
    });
  },

  async findShifts(gamingCenterId: string, staffIds: string[]) {
    return prisma.staffShift.findMany({
      where: { gamingCenterId, userId: { in: staffIds }, isActive: true },
    });
  },

  async findReservation(
    gamingCenterId: string,
    stationId: string,
    staffIds: string[],
    startDate: Date,
    endDate: Date
  ) {
    const [reservations, activeHolds] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          gamingCenterId,
          stationId,
          status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING'] },
          startTime: { lt: endDate },
          endTime: { gt: startDate },
        },
        select: {
          id: true,
          gamingCenterId: true,
          stationId: true,
          startTime: true,
          endTime: true,
          status: true,
        },
      }),
      prisma.bookingHold.findMany({
        where: {
          gamingCenterId,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
          startTime: { lt: endDate },
          endTime: { gt: startDate },
          items: {
            some: { stationId },
          },
        },
        select: {
          id: true,
          gamingCenterId: true,
          startTime: true,
          endTime: true,
        },
      }),
    ]);

    const holdIntervals = (activeHolds || []).map((h) => ({
      id: h.id,
      gamingCenterId: h.gamingCenterId,
      stationId,
      startTime: h.startTime,
      endTime: h.endTime,
      status: 'PENDING' as const,
    }));

    return [...(reservations || []), ...holdIntervals] as typeof reservations;
  },

  async findMaintenances(gamingCenterId: string, stationId: string, startDate: Date, endDate: Date) {
    return prisma.stationMaintenance.findMany({
      where: {
        stationId,
        station: { gamingCenterId },
        startTime: { lt: endDate },
        OR: [
          { endTime: null },
          { endTime: { gt: startDate } },
        ],
      },
    });
  },
};
