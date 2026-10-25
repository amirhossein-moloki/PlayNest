import { Prisma, ReservationStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

export interface CalendarReservationFilter {
  gamingCenterId: string;
  rangeStartUtc: Date;
  rangeEndUtc: Date;
  status?: ReservationStatus | ReservationStatus[];
  stationId?: string;
  staffId?: string;
  customerAccountId?: string;
  skip?: number;
  take?: number;
}

export const CalendarRepo = {
  async findGamingCenterWithSettings(gamingCenterId: string) {
    return prisma.gamingCenter.findUnique({
      where: { id: gamingCenterId },
      include: { settings: true },
    });
  },

  buildReservationWhere(filter: CalendarReservationFilter): Prisma.ReservationWhereInput {
    const { gamingCenterId, rangeStartUtc, rangeEndUtc, status, stationId, staffId, customerAccountId } = filter;

    const where: Prisma.ReservationWhereInput = {
      gamingCenterId,
      startTime: { lt: rangeEndUtc },
      endTime: { gt: rangeStartUtc },
    };

    if (status) {
      if (Array.isArray(status)) {
        where.status = { in: status };
      } else {
        where.status = status;
      }
    }

    if (stationId) {
      where.stationId = stationId;
    }

    if (staffId) {
      where.staffId = staffId;
    }

    if (customerAccountId) {
      where.customerAccountId = customerAccountId;
    }

    return where;
  },

  async findCalendarReservations(filter: CalendarReservationFilter) {
    const where = this.buildReservationWhere(filter);

    return prisma.reservation.findMany({
      where,
      skip: filter.skip,
      take: filter.take,
      orderBy: { startTime: 'asc' },
      include: {
        station: {
          select: {
            id: true,
            name: true,
            stationType: true,
            isVip: true,
            hourlyPrice: true,
            isActive: true,
          },
        },
        customerProfile: {
          select: {
            id: true,
            displayName: true,
          },
        },
        customerAccount: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        staff: {
          select: {
            id: true,
            fullName: true,
          },
        },
        groupBooking: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
  },

  async countCalendarReservations(filter: CalendarReservationFilter): Promise<number> {
    const where = this.buildReservationWhere(filter);
    return prisma.reservation.count({ where });
  },

  async findCalendarMaintenances(gamingCenterId: string, rangeStartUtc: Date, rangeEndUtc: Date, stationId?: string) {
    return prisma.stationMaintenance.findMany({
      where: {
        station: {
          gamingCenterId,
          ...(stationId ? { id: stationId } : {}),
        },
        startTime: { lt: rangeEndUtc },
        OR: [
          { endTime: null },
          { endTime: { gt: rangeStartUtc } },
        ],
      },
      orderBy: { startTime: 'asc' },
      include: {
        station: {
          select: {
            id: true,
            name: true,
            stationType: true,
          },
        },
      },
    });
  },

  async findCalendarStations(gamingCenterId: string, stationId?: string) {
    return prisma.gameStation.findMany({
      where: {
        gamingCenterId,
        ...(stationId ? { id: stationId } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        stationType: true,
        isVip: true,
        hourlyPrice: true,
        isActive: true,
      },
    });
  },
};
