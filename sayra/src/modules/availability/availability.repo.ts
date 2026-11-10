import { prisma } from '../../config/prisma';

export const AvailabilityRepo = {
  async findStationWithGamingCenter(stationId: string, gamingCenterSlug: string) {
    return prisma.gameStation.findFirst({
      where: {
        id: stationId,
        isActive: true,
        gamingCenter: { slug: gamingCenterSlug },
      },
      include: {
        gamingCenter: {
          include: {
            settings: true,
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
    });
  },

  async findStaffList(gamingCenterId: string, stationId: string) {
    return prisma.user.findMany({
      where: {
        gamingCenterId,
        stationSkills: { some: { stationId } },
        isActive: true,
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
    const reservations = await prisma.reservation.findMany({
      where: {
        gamingCenterId,
        stationId,
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING'] },
        startTime: { lt: endDate },
        endTime: { gt: startDate },
      },
    });

    const activeHolds = await prisma.bookingHold.findMany({
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
    });

    const holdIntervals = (activeHolds || []).map((h) => ({
      id: h.id,
      gamingCenterId: h.gamingCenterId,
      stationId,
      startTime: h.startTime,
      endTime: h.endTime,
      status: 'PENDING' as const,
    }));

    return [...reservations, ...holdIntervals] as typeof reservations;
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
