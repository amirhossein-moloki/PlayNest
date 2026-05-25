import { prisma } from '../../config/prisma';

export const AvailabilityRepo = {
  async findServiceWithSalon(stationId: string, salonSlug: string) {
    return prisma.gameStation.findFirst({
      where: {
        id: stationId,
        gamingCenter: { slug: salonSlug },
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
        userServices: { some: { stationId } },
      },
    });
  },

  async findStaffList(gamingCenterId: string, stationId: string) {
    return prisma.user.findMany({
      where: {
        gamingCenterId,
        userServices: { some: { stationId } },
        isActive: true,
      },
    });
  },

  async findShifts(staffIds: string[]) {
    return prisma.staffShift.findMany({
      where: { userId: { in: staffIds }, isActive: true },
    });
  },

  async findBookings(staffIds: string[], startDate: Date, endDate: Date) {
    return prisma.reservation.findMany({
      where: {
        staffId: { in: staffIds },
        status: { notIn: ['CANCELED', 'NO_SHOW'] },
        startTime: { gte: startDate },
        endTime: { lte: endDate },
      },
    });
  }
};
