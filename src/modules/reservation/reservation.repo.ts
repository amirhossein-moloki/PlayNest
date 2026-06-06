import { Prisma, ReservationStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const ReservationRepo = {
  async findStation(id: string, gamingCenterId: string, isActive?: boolean, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gameStation.findFirst({
      where: { id, gamingCenterId, isActive },
    });
  },

  async findStaff(id: string, gamingCenterId: string, stationId?: string, isPublic?: boolean, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.user.findFirst({
      where: {
        id,
        gamingCenterId,
        isActive: true,
        isPublic,
        ...(stationId ? { stationSkills: { some: { stationId } } } : {}),
      },
      select: { id: true },
    });
  },

  async findGamingCenterWithSettings(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenter.findUnique({
      where: { id },
      include: { settings: true },
    });
  },

  async findGamingCenterBySlugWithSettings(slug: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenter.findUnique({
      where: { slug },
      include: { settings: true },
    });
  },

  async findStaffShift(gamingCenterId: string, userId: string, dayOfWeek: number, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.staffShift.findFirst({
      where: {
        gamingCenterId,
        userId,
        dayOfWeek,
        isActive: true,
      },
    });
  },

  async findOverlappingReservation(gamingCenterId: string, staffId: string, startTime: Date, endTime: Date, excludeReservationId?: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.reservation.findFirst({
      where: {
        gamingCenterId,
        staffId,
        id: excludeReservationId ? { not: excludeReservationId } : undefined,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: { id: true },
    });
  },

  async findCustomerAccountByPhone(phone: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.customerAccount.findUnique({
      where: { phone },
    });
  },

  async createCustomerAccount(data: Prisma.CustomerAccountCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.customerAccount.create({ data });
  },

  async findCustomerProfile(gamingCenterId: string, customerAccountId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.customerProfile.findUnique({
      where: {
        gamingCenterId_customerAccountId: {
          gamingCenterId,
          customerAccountId,
        },
      },
    });
  },

  async createCustomerProfile(data: Prisma.CustomerProfileUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.customerProfile.create({ data });
  },

  async createReservation(data: Prisma.ReservationUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.reservation.create({ data });
  },

  async findReservationById(id: string, gamingCenterId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.reservation.findFirst({
      where: { id, gamingCenterId },
    });
  },

  async findManyReservation(where: Prisma.ReservationWhereInput, skip: number, take: number, orderBy: any, tx?: Prisma.TransactionClient) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const client = tx || prisma;
    return client.reservation.findMany({
      where,
      skip,
      take,
      orderBy,
    });
  },

  async countReservation(where: Prisma.ReservationWhereInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.reservation.count({ where });
  },

  async updateReservation(id: string, gamingCenterId: string, data: Prisma.ReservationUncheckedUpdateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const result = await client.reservation.updateMany({
      where: { id, gamingCenterId },
      data,
    });
    if (result.count === 0) return null;
    return client.reservation.findUnique({ where: { id } });
  },

  async updateReservationWithInclude(id: string, gamingCenterId: string, data: Prisma.ReservationUncheckedUpdateInput, include: Prisma.ReservationInclude, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const result = await client.reservation.updateMany({
      where: { id, gamingCenterId },
      data,
    });
    if (result.count === 0) return null;
    return client.reservation.findUnique({ where: { id }, include });
  },

  async findSettings(gamingCenterId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.settings.findUnique({
      where: { gamingCenterId },
    });
  },

  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: { isolationLevel?: Prisma.TransactionIsolationLevel }) {
    return prisma.$transaction(fn, options);
  }
};
