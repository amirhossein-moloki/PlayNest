import {
  AllowedDomainRuleType,
  Prisma,
  SessionActorType,
  ShortLinkCampaignStatus,
  ShortLinkClickClassification,
  ShortLinkOwnerType,
  ShortLinkStatus,
  ShortLinkTargetCategory,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { buildPersianArabicSearchVariants } from '../../common/utils/searchText';

export interface CreateShortLinkRecordInput {
  code: string;
  normalizedCode: string;
  isCustomCode: boolean;
  destinationUrl: string;
  destinationHost: string;
  title?: string | null;
  description?: string | null;
  targetCategory: ShortLinkTargetCategory;
  targetEntityId?: string | null;
  ownerType: ShortLinkOwnerType;
  gamingCenterId?: string | null;
  ownerUserId?: string | null;
  createdByUserId?: string | null;
  createdByAdminId?: string | null;
  campaignId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  appendUtmParams: boolean;
  status: ShortLinkStatus;
  redirectStatusCode: number;
  expiresAt?: Date | null;
  maxClicks?: number | null;
  qrConfig?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}

export const ShortLinksRepo = {
  async findByCodeForRedirect(normalizedCode: string) {
    return prisma.shortLink.findUnique({
      where: { normalizedCode },
      select: {
        id: true,
        code: true,
        normalizedCode: true,
        destinationUrl: true,
        destinationHost: true,
        status: true,
        redirectStatusCode: true,
        expiresAt: true,
        maxClicks: true,
        totalClicks: true,
        deletedAt: true,
        gamingCenterId: true,
        campaignId: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmTerm: true,
        utmContent: true,
        appendUtmParams: true,
        campaign: {
          select: {
            id: true,
            status: true,
            startsAt: true,
            endsAt: true,
            utmSource: true,
            utmMedium: true,
            utmCampaign: true,
            utmTerm: true,
            utmContent: true,
          },
        },
      },
    });
  },

  async findByNormalizedCode(normalizedCode: string) {
    return prisma.shortLink.findUnique({
      where: { normalizedCode },
    });
  },

  async findById(id: string) {
    return prisma.shortLink.findUnique({
      where: { id },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            adSource: true,
            gamingCenterId: true,
          },
        },
        gamingCenter: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  },

  async countActiveCenterLinks(gamingCenterId: string): Promise<number> {
    return prisma.shortLink.count({
      where: {
        gamingCenterId,
        deletedAt: null,
      },
    });
  },

  async createLink(
    data: CreateShortLinkRecordInput,
    changeLog: {
      actorType: SessionActorType;
      actorUserId?: string;
      actorAdminId?: string;
      ipHash?: string;
      userAgent?: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const link = await tx.shortLink.create({
        data,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              adSource: true,
              gamingCenterId: true,
            },
          },
          gamingCenter: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      if (typeof tx.shortLinkChangeLog?.create === 'function') {
        await tx.shortLinkChangeLog.create({
          data: {
            shortLinkId: link.id,
            action: 'LINK_CREATED',
            actorType: changeLog.actorType,
            actorUserId: changeLog.actorUserId ?? null,
            actorAdminId: changeLog.actorAdminId ?? null,
            newDestinationUrl: link.destinationUrl,
            changes: {
              code: link.code,
              targetCategory: link.targetCategory,
              status: link.status,
              campaignId: link.campaignId,
            },
            ipHash: changeLog.ipHash ?? null,
            userAgent: changeLog.userAgent ?? null,
          },
        });
      }

      return link;
    });
  },

  async updateLinkWithHistory(
    id: string,
    data: Prisma.ShortLinkUpdateInput,
    history: {
      action: string;
      actorType: SessionActorType;
      actorUserId?: string;
      actorAdminId?: string;
      previousDestinationUrl?: string;
      newDestinationUrl?: string;
      changes: Prisma.InputJsonValue;
      ipHash?: string;
      userAgent?: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.shortLink.update({
        where: { id },
        data,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              adSource: true,
              gamingCenterId: true,
            },
          },
          gamingCenter: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      if (typeof tx.shortLinkChangeLog?.create === 'function') {
        await tx.shortLinkChangeLog.create({
          data: {
            shortLinkId: id,
            action: history.action,
            actorType: history.actorType,
            actorUserId: history.actorUserId ?? null,
            actorAdminId: history.actorAdminId ?? null,
            previousDestinationUrl: history.previousDestinationUrl ?? null,
            newDestinationUrl: history.newDestinationUrl ?? null,
            changes: history.changes,
            ipHash: history.ipHash ?? null,
            userAgent: history.userAgent ?? null,
          },
        });
      }

      return updated;
    });
  },

  async listLinks(params: {
    gamingCenterId?: string;
    ownerUserId?: string;
    search?: string;
    status?: ShortLinkStatus;
    targetCategory?: ShortLinkTargetCategory;
    campaignId?: string;
    isCustomCode?: boolean;
    expiredOnly?: boolean;
    includeDeleted?: boolean;
    page: number;
    limit: number;
    sortBy: 'createdAt' | 'updatedAt' | 'totalClicks' | 'validClicks' | 'lastClickedAt';
    sortOrder: 'asc' | 'desc';
  }) {
    const andConditions: Prisma.ShortLinkWhereInput[] = [];

    if (!params.includeDeleted) {
      andConditions.push({ deletedAt: null });
    }
    if (params.gamingCenterId) {
      andConditions.push({ gamingCenterId: params.gamingCenterId });
    }
    if (params.ownerUserId) {
      andConditions.push({ ownerUserId: params.ownerUserId, ownerType: ShortLinkOwnerType.USER });
    }
    if (params.status) {
      andConditions.push({ status: params.status });
    }
    if (params.targetCategory) {
      andConditions.push({ targetCategory: params.targetCategory });
    }
    if (params.campaignId) {
      andConditions.push({ campaignId: params.campaignId });
    }
    if (params.isCustomCode !== undefined) {
      andConditions.push({ isCustomCode: params.isCustomCode });
    }
    if (params.expiredOnly === true) {
      andConditions.push({ expiresAt: { lt: new Date() } });
    }

    if (params.search) {
      const variants = buildPersianArabicSearchVariants(params.search);
      const searchOr: Prisma.ShortLinkWhereInput[] = [];
      for (const v of variants) {
        searchOr.push(
          { code: { contains: v, mode: 'insensitive' } },
          { normalizedCode: { contains: v.toLowerCase(), mode: 'insensitive' } },
          { title: { contains: v, mode: 'insensitive' } },
          { description: { contains: v, mode: 'insensitive' } },
          { destinationUrl: { contains: v, mode: 'insensitive' } }
        );
      }
      if (searchOr.length > 0) {
        andConditions.push({ OR: searchOr });
      }
    }

    const where: Prisma.ShortLinkWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};
    const skip = (params.page - 1) * params.limit;

    const [items, total] = await Promise.all([
      prisma.shortLink.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { [params.sortBy]: params.sortOrder },
        include: {
          campaign: {
            select: { id: true, name: true, slug: true, status: true },
          },
          gamingCenter: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      prisma.shortLink.count({ where }),
    ]);

    return { items, total };
  },

  async findChangeLogs(shortLinkId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.shortLinkChangeLog.findMany({
        where: { shortLinkId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.shortLinkChangeLog.count({ where: { shortLinkId } }),
    ]);
    return { items, total };
  },

  async getDailyStatsForLink(shortLinkId: string, fromDate: Date, toDate: Date) {
    if (typeof prisma.shortLinkDailyStat?.findMany !== 'function') {
      return [];
    }
    return prisma.shortLinkDailyStat.findMany({
      where: {
        shortLinkId,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: 'asc' },
    });
  },

  async getClicksInRangeForLink(shortLinkId: string, fromDate: Date, toDate: Date) {
    if (typeof prisma.shortLinkClick?.findMany !== 'function') {
      return [];
    }
    return prisma.shortLinkClick.findMany({
      where: {
        shortLinkId,
        clickedAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { clickedAt: 'desc' },
      take: 10000,
    });
  },

  async persistClickEvent(event: {
    shortLinkId: string;
    campaignId: string | null;
    gamingCenterId: string | null;
    clickedAt: Date;
    classification: ShortLinkClickClassification;
    isUniqueVisitor: boolean;
    visitorHash: string;
    deviceType: string;
    os: string;
    browser: string;
    countryCode: string | null;
    region: string | null;
    referrer: string | null;
    referrerDomain: string | null;
    trafficSource: string;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    utmContent: string | null;
    botReason: string | null;
  }) {
    const isValid = event.classification === ShortLinkClickClassification.VALID;
    const isDup = event.classification === ShortLinkClickClassification.DUPLICATE;
    const isBot = event.classification === ShortLinkClickClassification.BOT;
    const isSuspicious = event.classification === ShortLinkClickClassification.SUSPICIOUS;
    const countAsUnique = event.isUniqueVisitor && !isBot;

    const dateOnly = new Date(
      Date.UTC(
        event.clickedAt.getUTCFullYear(),
        event.clickedAt.getUTCMonth(),
        event.clickedAt.getUTCDate()
      )
    );

    const tasks: Promise<unknown>[] = [];

    if (typeof prisma.shortLinkClick?.create === 'function') {
      tasks.push(
        prisma.shortLinkClick.create({
          data: {
            shortLinkId: event.shortLinkId,
            campaignId: event.campaignId,
            gamingCenterId: event.gamingCenterId,
            clickedAt: event.clickedAt,
            classification: event.classification,
            isUniqueVisitor: countAsUnique,
            visitorHash: event.visitorHash,
            deviceType: event.deviceType,
            os: event.os,
            browser: event.browser,
            countryCode: event.countryCode,
            region: event.region,
            referrer: event.referrer,
            referrerDomain: event.referrerDomain,
            trafficSource: event.trafficSource,
            utmSource: event.utmSource,
            utmMedium: event.utmMedium,
            utmCampaign: event.utmCampaign,
            utmTerm: event.utmTerm,
            utmContent: event.utmContent,
            botReason: event.botReason,
          },
        })
      );
    }

    if (typeof prisma.shortLink?.update === 'function') {
      tasks.push(
        prisma.shortLink.update({
          where: { id: event.shortLinkId },
          data: {
            totalClicks: { increment: 1 },
            ...(isValid ? { validClicks: { increment: 1 } } : {}),
            ...(countAsUnique ? { uniqueClicks: { increment: 1 } } : {}),
            ...(isDup ? { duplicateClicks: { increment: 1 } } : {}),
            ...(isBot ? { botClicks: { increment: 1 } } : {}),
            ...(isSuspicious ? { suspiciousClicks: { increment: 1 } } : {}),
            lastClickedAt: event.clickedAt,
          },
        })
      );
    }

    if (typeof prisma.shortLinkDailyStat?.upsert === 'function') {
      tasks.push(
        prisma.shortLinkDailyStat.upsert({
          where: {
            shortLinkId_date: {
              shortLinkId: event.shortLinkId,
              date: dateOnly,
            },
          },
          update: {
            totalClicks: { increment: 1 },
            ...(isValid ? { validClicks: { increment: 1 } } : {}),
            ...(countAsUnique ? { uniqueClicks: { increment: 1 } } : {}),
            ...(isDup ? { duplicateClicks: { increment: 1 } } : {}),
            ...(isBot ? { botClicks: { increment: 1 } } : {}),
            ...(isSuspicious ? { suspiciousClicks: { increment: 1 } } : {}),
          },
          create: {
            shortLinkId: event.shortLinkId,
            date: dateOnly,
            totalClicks: 1,
            validClicks: isValid ? 1 : 0,
            uniqueClicks: countAsUnique ? 1 : 0,
            duplicateClicks: isDup ? 1 : 0,
            botClicks: isBot ? 1 : 0,
            suspiciousClicks: isSuspicious ? 1 : 0,
          },
        })
      );
    }

    await Promise.all(tasks);
  },

  // =====================================
  // Campaigns
  // =====================================
  async findCampaignById(id: string) {
    return prisma.shortLinkCampaign.findUnique({
      where: { id },
      include: {
        gamingCenter: { select: { id: true, name: true, slug: true } },
        _count: { select: { links: true } },
      },
    });
  },

  async findCampaignBySlug(gamingCenterId: string | null, slug: string) {
    return prisma.shortLinkCampaign.findFirst({
      where: {
        gamingCenterId,
        slug: slug.toLowerCase(),
        deletedAt: null,
      },
    });
  },

  async createCampaign(data: Prisma.ShortLinkCampaignUncheckedCreateInput) {
    return prisma.shortLinkCampaign.create({
      data,
      include: {
        gamingCenter: { select: { id: true, name: true, slug: true } },
      },
    });
  },

  async updateCampaign(id: string, data: Prisma.ShortLinkCampaignUpdateInput) {
    return prisma.shortLinkCampaign.update({
      where: { id },
      data,
      include: {
        gamingCenter: { select: { id: true, name: true, slug: true } },
      },
    });
  },

  async listCampaigns(params: {
    gamingCenterId?: string;
    search?: string;
    status?: ShortLinkCampaignStatus;
    page: number;
    limit: number;
  }) {
    const andConditions: Prisma.ShortLinkCampaignWhereInput[] = [{ deletedAt: null }];
    if (params.gamingCenterId) {
      andConditions.push({ gamingCenterId: params.gamingCenterId });
    }
    if (params.status) {
      andConditions.push({ status: params.status });
    }
    if (params.search) {
      const variants = buildPersianArabicSearchVariants(params.search);
      const orList: Prisma.ShortLinkCampaignWhereInput[] = [];
      for (const v of variants) {
        orList.push(
          { name: { contains: v, mode: 'insensitive' } },
          { slug: { contains: v.toLowerCase(), mode: 'insensitive' } },
          { adSource: { contains: v, mode: 'insensitive' } }
        );
      }
      andConditions.push({ OR: orList });
    }

    const where: Prisma.ShortLinkCampaignWhereInput = { AND: andConditions };
    const skip = (params.page - 1) * params.limit;

    const [items, total] = await Promise.all([
      prisma.shortLinkCampaign.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          gamingCenter: { select: { id: true, name: true, slug: true } },
          _count: { select: { links: true } },
        },
      }),
      prisma.shortLinkCampaign.count({ where }),
    ]);

    return { items, total };
  },

  async findCampaignLinks(campaignId: string) {
    return prisma.shortLink.findMany({
      where: {
        campaignId,
        deletedAt: null,
      },
      orderBy: [{ validClicks: 'desc' }, { totalClicks: 'desc' }],
    });
  },

  async findCampaignClicksInRange(campaignId: string, fromDate: Date, toDate: Date) {
    if (typeof prisma.shortLinkClick?.findMany !== 'function') {
      return [];
    }
    return prisma.shortLinkClick.findMany({
      where: {
        campaignId,
        clickedAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { clickedAt: 'desc' },
      take: 15000,
    });
  },

  // =====================================
  // Domain Rules (Platform Admin)
  // =====================================
  async listDomainRules() {
    return prisma.shortLinkDomainRule.findMany({
      orderBy: [{ ruleType: 'asc' }, { domain: 'asc' }],
    });
  },

  async findDomainRuleById(id: string) {
    return prisma.shortLinkDomainRule.findUnique({ where: { id } });
  },

  async findDomainRuleByDomain(domain: string) {
    return prisma.shortLinkDomainRule.findUnique({ where: { domain: domain.toLowerCase() } });
  },

  async createDomainRule(data: {
    domain: string;
    ruleType: AllowedDomainRuleType;
    includeSubdomains: boolean;
    isActive: boolean;
    description?: string | null;
    createdByAdminId?: string | null;
  }) {
    return prisma.shortLinkDomainRule.create({
      data: {
        ...data,
        domain: data.domain.toLowerCase().replace(/^\*\.+/, '').replace(/\.+$/, ''),
      },
    });
  },

  async updateDomainRule(id: string, data: Prisma.ShortLinkDomainRuleUpdateInput) {
    return prisma.shortLinkDomainRule.update({
      where: { id },
      data,
    });
  },

  async deleteDomainRule(id: string) {
    return prisma.shortLinkDomainRule.delete({
      where: { id },
    });
  },
};
