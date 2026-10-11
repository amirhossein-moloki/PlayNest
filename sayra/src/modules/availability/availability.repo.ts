import { prisma } from '../../config/prisma';

export const AvailabilityRepo = {
  async findStationWithGamingCenter(stationId: string, gamingCenterSlug: string) {
    return prisma.gameStation.findFirst({
      where: {
        id: stationId,
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

  async findReservation(gamingCenterId: string, staffIds: string[], startDate: Date, endDate: Date) {
    return prisma.reservation.findMany({
      where: {
        gamingCenterId,
        staffId: { in: staffIds },
        status: { notIn: ['CANCELED', 'NO_SHOW'] },
        startTime: { gte: startDate },
        endTime: { lte: endDate },
      },
    });
  }
};
