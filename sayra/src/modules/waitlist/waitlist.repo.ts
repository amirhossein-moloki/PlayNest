import { Prisma, WaitlistEntry, WaitlistOffer, WaitlistStatus, WaitlistOfferStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const WaitlistRepo = {
  async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel }
  ): Promise<T> {
    return prisma.$transaction(fn, options);
  },

  async lockWaitlistEntryForUpdate(entryId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const result = await client.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "WaitlistEntry" WHERE id = ${entryId} FOR UPDATE
    `;
    return result[0];
  },

  async lockWaitlistOfferForUpdate(offerId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const result = await client.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "WaitlistOffer" WHERE id = ${offerId} FOR UPDATE
    `;
    return result[0];
  },

  async createWaitlistEntry(
    data: Prisma.WaitlistEntryUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<WaitlistEntry> {
    const client = tx || prisma;
    return client.waitlistEntry.create({ data });
  },

  async findActiveWaitlistEntryForCustomer(
    customerAccountId: string,
    stationId: string,
    startTime: Date,
    endTime: Date,
    tx?: Prisma.TransactionClient
  ): Promise<WaitlistEntry | null> {
    const client = tx || prisma;
    return client.waitlistEntry.findFirst({
      where: {
        customerAccountId,
        stationId,
        startTime,
        endTime,
        status: WaitlistStatus.ACTIVE,
      },
    });
  },

  async findWaitlistEntryById(
    entryId: string,
    gamingCenterId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<(WaitlistEntry & { offers: WaitlistOffer[]; station: { name: string }; customerAccount: { fullName: string | null; phone: string } }) | null> {
    const client = tx || prisma;
    const where: Prisma.WaitlistEntryWhereInput = { id: entryId };
    if (gamingCenterId) {
      where.gamingCenterId = gamingCenterId;
    }
    return client.waitlistEntry.findFirst({
      where,
      include: {
        offers: {
          orderBy: { createdAt: 'desc' },
        },
        station: {
          select: { name: true },
        },
        customerAccount: {
          select: { fullName: true, phone: true },
        },
      },
    });
  },

  async findManyWaitlistEntries(
    where: Prisma.WaitlistEntryWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.WaitlistEntryOrderByWithRelationInput = { createdAt: 'desc' },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.waitlistEntry.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        station: {
          select: { id: true, name: true, stationType: true },
        },
        customerAccount: {
          select: { id: true, fullName: true, phone: true },
        },
        offers: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  },

  async countWaitlistEntries(
    where: Prisma.WaitlistEntryWhereInput,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx || prisma;
    return client.waitlistEntry.count({ where });
  },

  async updateWaitlistEntry(
    entryId: string,
    data: Prisma.WaitlistEntryUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<WaitlistEntry> {
    const client = tx || prisma;
    return client.waitlistEntry.update({
      where: { id: entryId },
      data,
    });
  },

  async findActiveWaitlistEntriesForMatching(
    gamingCenterId: string,
    stationId: string,
    slotStart: Date,
    slotEnd: Date,
    tx?: Prisma.TransactionClient
  ): Promise<WaitlistEntry[]> {
    const client = tx || prisma;
    return client.waitlistEntry.findMany({
      where: {
        gamingCenterId,
        stationId,
        status: WaitlistStatus.ACTIVE,
        startTime: { gte: slotStart },
        endTime: { lte: slotEnd },
      },
      orderBy: { createdAt: 'asc' }, // FIFO fairness ordering
    });
  },

  async createWaitlistOffer(
    data: Prisma.WaitlistOfferUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<WaitlistOffer> {
    const client = tx || prisma;
    return client.waitlistOffer.create({ data });
  },

  async findWaitlistOfferById(
    offerId: string,
    gamingCenterId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<(WaitlistOffer & { waitlistEntry: WaitlistEntry; station: { name: string; hourlyPrice: number; stationType: string } }) | null> {
    const client = tx || prisma;
    const where: Prisma.WaitlistOfferWhereInput = { id: offerId };
    if (gamingCenterId) {
      where.gamingCenterId = gamingCenterId;
    }
    return client.waitlistOffer.findFirst({
      where,
      include: {
        waitlistEntry: true,
        station: {
          select: { name: true, hourlyPrice: true, stationType: true },
        },
      },
    });
  },

  async findPendingOfferForEntry(
    waitlistEntryId: string,
    tx?: Prisma.TransactionClient
  ): Promise<WaitlistOffer | null> {
    const client = tx || prisma;
    return client.waitlistOffer.findFirst({
      where: {
        waitlistEntryId,
        status: WaitlistOfferStatus.PENDING,
      },
    });
  },

  async findManyWaitlistOffers(
    where: Prisma.WaitlistOfferWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.WaitlistOfferOrderByWithRelationInput = { createdAt: 'desc' },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.waitlistOffer.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        station: {
          select: { id: true, name: true },
        },
        waitlistEntry: {
          include: {
            customerAccount: {
              select: { id: true, fullName: true, phone: true },
            },
          },
        },
      },
    });
  },

  async countWaitlistOffers(
    where: Prisma.WaitlistOfferWhereInput,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx || prisma;
    return client.waitlistOffer.count({ where });
  },

  async updateWaitlistOffer(
    offerId: string,
    data: Prisma.WaitlistOfferUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<WaitlistOffer> {
    const client = tx || prisma;
    return client.waitlistOffer.update({
      where: { id: offerId },
      data,
    });
  },

  async findExpiredOffers(
    now: Date = new Date(),
    limit = 50,
    tx?: Prisma.TransactionClient
  ): Promise<WaitlistOffer[]> {
    const client = tx || prisma;
    return client.waitlistOffer.findMany({
      where: {
        status: WaitlistOfferStatus.PENDING,
        expiresAt: { lte: now },
      },
      take: limit,
      orderBy: { expiresAt: 'asc' },
    });
  },

  async findExpiredWaitlistEntries(
    now: Date = new Date(),
    limit = 50,
    tx?: Prisma.TransactionClient
  ): Promise<WaitlistEntry[]> {
    const client = tx || prisma;
    return client.waitlistEntry.findMany({
      where: {
        status: WaitlistStatus.ACTIVE,
        OR: [
          { expiresAt: { lte: now } },
          { startTime: { lte: now } },
        ],
      },
      take: limit,
      orderBy: { startTime: 'asc' },
    });
  },
};
