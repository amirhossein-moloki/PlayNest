import { prisma } from '../../config/prisma';
import { CreateGamingCenterInput, UpdateGamingCenterInput, GamingCenterListItem, GamingCenterPricing, DeviceTypeCounts } from './gamingCenter.types';
import { toPublicStationType } from '../../common/utils/station-type';
import { Prisma, GameStation, GameStationType, GamePlayMode, Rating, Settings, Address, DiscountValueType, GamingCenterVerificationStatus } from '@prisma/client';
import { ListGamingCentersQuery, GetGamingCenterDetailsQuery } from './gamingCenter.validation';
import { getPaginationParams, formatPaginatedResult } from '../../common/utils/pagination';
import { resolveCancellationWindowMinutes } from '../reservation/reservation.validation';
import { resolveActiveClosureSummary } from '../closures/closures.validators';
import { evaluateCenterOpenStatus } from '../../common/utils/operatingHours';
import {
  buildPersianArabicSearchVariants,
  calculateHaversineDistanceKm,
  getGeoBoundingBox,
  isValidCoordinatePair,
} from '../../common/utils/searchText';
import { resolveMatchingGames } from '../search/gameIndex.service';
import { resolveCenterGameStations } from '../search/search.service';
import { computeBayesianScore, computeGlobalAverageC } from '../public-gamecenters/bayesian.ranking';
import { env } from '../../config/env';

export function checkIsOpen(
  openingTime?: string | null,
  closingTime?: string | null,
  timeZone: string = 'Asia/Tehran',
  now: Date = new Date()
): boolean {
  return evaluateCenterOpenStatus({
    openingTime,
    closingTime,
    timezone: timeZone,
    now,
  }).isOpenNow;
}

type NarrowedSettings = Partial<Settings>;
type NarrowedStation = Pick<GameStation, 'id' | 'stationType' | 'name' | 'hourlyPrice' | 'isActive'> & {
  isVip?: boolean;
  stationGames?: Array<{ gameCatalogId: string; playMode: GamePlayMode; isActive: boolean }>;
};
type NarrowedManager = {
  id: string;
  fullName: string;
  role: string;
};

type GamingCenterWithRelations = Omit<
  Prisma.GamingCenterGetPayload<{
    include: {
      addresses: true;
    };
  }>,
  never
> & {
  ratings?: Rating[];
  settings?: NarrowedSettings | null;
  manager?: NarrowedManager | null;
  stations?: NarrowedStation[];
  schedules?: Array<{
    dayOfWeek: number;
    startTime: string | null;
    endTime: string | null;
    isClosed: boolean;
  }>;
  centerGames?: Array<{
    gameCatalogId: string;
    playMode: GamePlayMode;
    platforms?: GameStationType[];
  }>;
  stationExtraControllers?: Array<{ id: string }>;
  media?: Array<{
    url: string;
    thumbUrl?: string | null;
    purpose: string;
    isActive: boolean;
    sortOrder?: number;
  }>;
  discounts?: Array<{
    isActive: boolean;
    valueType?: DiscountValueType | string;
    value?: number;
    startAt: Date;
    endAt: Date;
  }>;
  discountCampaigns?: Array<{
    isActive: boolean;
    valueType?: DiscountValueType | string;
    discountType?: DiscountValueType | string | null;
    value?: number;
    discountValue?: number | null;
    maxDiscountAmount?: number | null;
    status?: string | null;
    deletedAt?: Date | null;
    startAt: Date;
    endAt: Date;
  }>;
  hasDiscount?: boolean;
  coverImages?: string[];
  coverImageUrl?: string | null;
  banner?: string | null;
  pricing?: GamingCenterPricing;
  closures?: Array<{
    id: string;
    title: string | null;
    reason: string | null;
    startDate: Date;
    endDate: Date;
  }>;
};

export function checkHasActiveDiscount(
  gc: {
    discounts?: Array<{ isActive: boolean; startAt: Date; endAt: Date }>;
    discountCampaigns?: Array<{ isActive: boolean; status?: string | null; deletedAt?: Date | null; startAt: Date; endAt: Date }>;
  },
  now: Date = new Date()
): boolean {
  if (Array.isArray(gc.discounts)) {
    const hasActiveDiscount = gc.discounts.some(
      (d) => d.isActive && new Date(d.startAt) <= now && new Date(d.endAt) >= now
    );
    if (hasActiveDiscount) return true;
  }

  if (Array.isArray(gc.discountCampaigns)) {
    const hasActiveCampaign = gc.discountCampaigns.some(
      (c) =>
        c.isActive &&
        (!c.status || c.status === 'ACTIVE') &&
        !c.deletedAt &&
        new Date(c.startAt) <= now &&
        new Date(c.endAt) >= now
    );
    if (hasActiveCampaign) return true;
  }

  return false;
}

export function extractCoverImages(
  media?: Array<{
    url: string;
    thumbUrl?: string | null;
    purpose: string;
    isActive: boolean;
    sortOrder?: number;
  }>
): { coverImages: string[]; coverImageUrl: string | null; banner: string | null } {
  if (!media || !Array.isArray(media) || media.length === 0) {
    return { coverImages: [], coverImageUrl: null, banner: null };
  }

  const activeCovers = media
    .filter((m) => m.isActive && m.purpose === 'COVER')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const covers = activeCovers.length > 0 ? activeCovers : media.filter((m) => m.isActive);
  const urls = covers.map((m) => m.url).filter(Boolean);

  return {
    coverImages: urls,
    coverImageUrl: urls[0] ?? null,
    banner: urls[0] ?? null,
  };
}

export function calculateGamingCenterPricing(
  originalPrice: number,
  discounts?: Array<{
    isActive: boolean;
    valueType?: DiscountValueType | string;
    value?: number;
    startAt: Date;
    endAt: Date;
  }>,
  discountCampaigns?: Array<{
    isActive: boolean;
    valueType?: DiscountValueType | string;
    discountType?: DiscountValueType | string | null;
    value?: number;
    discountValue?: number | null;
    maxDiscountAmount?: number | null;
    status?: string | null;
    deletedAt?: Date | null;
    startAt: Date;
    endAt: Date;
  }>,
  now: Date = new Date()
): GamingCenterPricing {
  if (originalPrice <= 0) {
    return {
      originalPrice,
      discountPercentage: 0,
      discountAmount: 0,
      finalPrice: originalPrice,
      hasDiscount: false,
    };
  }

  // Filter valid discounts based on active timeframe and status
  const validDiscounts: Array<{
    valueType: 'PERCENTAGE' | 'FIXED_AMOUNT';
    value: number;
    maxDiscountAmount?: number | null;
  }> = [];

  if (Array.isArray(discounts)) {
    for (const d of discounts) {
      if (d.isActive && new Date(d.startAt) <= now && new Date(d.endAt) >= now) {
        const valType = (d.valueType as 'PERCENTAGE' | 'FIXED_AMOUNT') || 'PERCENTAGE';
        const val = typeof d.value === 'number' ? d.value : 0;
        if (val > 0) {
          validDiscounts.push({ valueType: valType, value: val });
        }
      }
    }
  }

  if (Array.isArray(discountCampaigns)) {
    for (const c of discountCampaigns) {
      if (
        c.isActive &&
        (!c.status || c.status === 'ACTIVE') &&
        !c.deletedAt &&
        new Date(c.startAt) <= now &&
        new Date(c.endAt) >= now
      ) {
        const valType = (c.discountType || c.valueType || 'PERCENTAGE') as 'PERCENTAGE' | 'FIXED_AMOUNT';
        const val = typeof c.discountValue === 'number' ? c.discountValue : (typeof c.value === 'number' ? c.value : 0);
        if (val > 0) {
          validDiscounts.push({
            valueType: valType,
            value: val,
            maxDiscountAmount: c.maxDiscountAmount,
          });
        }
      }
    }
  }

  if (validDiscounts.length === 0) {
    return {
      originalPrice,
      discountPercentage: 0,
      discountAmount: 0,
      finalPrice: originalPrice,
      hasDiscount: false,
    };
  }

  // Evaluate candidate discounts and pick the best one (highest discount amount)
  let bestDiscountAmount = 0;
  let bestPercentage = 0;

  for (const item of validDiscounts) {
    let amt = 0;
    let pct = 0;

    if (item.valueType === 'PERCENTAGE') {
      pct = item.value;
      amt = (originalPrice * pct) / 100;
      if (item.maxDiscountAmount !== undefined && item.maxDiscountAmount !== null && item.maxDiscountAmount > 0) {
        amt = Math.min(amt, item.maxDiscountAmount);
      }
    } else if (item.valueType === 'FIXED_AMOUNT') {
      amt = item.value;
      pct = Math.round((amt / originalPrice) * 10000) / 100;
    }

    amt = Math.min(originalPrice, Math.max(0, Math.round(amt * 100) / 100));

    if (amt > bestDiscountAmount) {
      bestDiscountAmount = amt;
      bestPercentage = Math.round(pct * 100) / 100;
    }
  }

  if (bestDiscountAmount <= 0) {
    return {
      originalPrice,
      discountPercentage: 0,
      discountAmount: 0,
      finalPrice: originalPrice,
      hasDiscount: false,
    };
  }

  const finalPrice = Math.max(0, Math.round((originalPrice - bestDiscountAmount) * 100) / 100);

  return {
    originalPrice,
    discountPercentage: bestPercentage,
    discountAmount: bestDiscountAmount,
    finalPrice,
    hasDiscount: true,
  };
}

export function transformGamingCenter(
  gc: GamingCenterWithRelations,
  deviceCounts?: DeviceTypeCounts,
  extraData?: {
    hasDiscount?: boolean;
    coverImages?: string[];
    coverImageUrl?: string | null;
    lowestStationPrice?: number | null;
    ratingSummary?: {
      avgRating: number;
      count: number;
      commentCount: number;
    };
  }
): GamingCenterListItem {
  const stations: NarrowedStation[] = gc.stations || [];
  const ratings: Rating[] = gc.ratings || [];
  const settings: NarrowedSettings | null = gc.settings || null;
  const addresses: Address[] = gc.addresses || [];
  const manager = gc.manager || null;

  let hasPc = (deviceCounts ? deviceCounts.PC > 0 : false) || gc.pcCount > 0;
  let hasPs4 = deviceCounts ? deviceCounts['PLAYSTATION 4'] > 0 : false;
  let hasPs5 = deviceCounts ? deviceCounts['PLAYSTATION 5'] > 0 : false;
  let hasXbox = deviceCounts ? deviceCounts.XBOX > 0 : false;

  for (const st of stations) {
    const type = toPublicStationType(st.stationType);
    const nameLower = (st.name || '').toLowerCase();

    if (type === 'PC') {
      hasPc = true;
    } else if (type === 'PLAYSTATION 4') {
      hasPs4 = true;
    } else if (type === 'PLAYSTATION 5') {
      if (nameLower.includes('ps4')) {
        hasPs4 = true;
      } else {
        hasPs5 = true;
      }
    } else if (type === 'XBOX') {
      hasXbox = true;
    }
  }

  // Fallback checks from description or center fields if not indicated in stations
  const descLower = (gc.description || '').toLowerCase();
  if (descLower.includes('ps4')) {
    hasPs4 = true;
  }
  if (descLower.includes('ps5')) {
    hasPs5 = true;
  }
  if (descLower.includes('xbox')) {
    hasXbox = true;
  }

  // Calculate rating and comment count (prefer pre-aggregated SQL summary when provided)
  let count = 0;
  let avgRating = 0;
  let commentCount = 0;

  if (extraData?.ratingSummary) {
    count = extraData.ratingSummary.count;
    avgRating = extraData.ratingSummary.avgRating;
    commentCount = extraData.ratingSummary.commentCount;
  } else {
    const publishedRatings = ratings.filter((r) => r.status === 'PUBLISHED');
    count = publishedRatings.length;
    if (count > 0) {
      const sum = publishedRatings.reduce((acc, curr) => acc + curr.rating, 0);
      avgRating = Math.round((sum / count) * 10) / 10;
    }
    commentCount = publishedRatings.filter((r) => r.comment && r.comment.trim().length > 0).length;
  }

  const openStatus = evaluateCenterOpenStatus({
    openingTime: gc.openingTime,
    closingTime: gc.closingTime,
    closedDays: gc.closedDays,
    timezone: gc.timezone,
    settings,
    schedules: gc.schedules,
    closures: gc.closures,
  });
  const isOpen = openStatus.isOpenNow;

  const finalPcCount = deviceCounts && (deviceCounts.PC > 0 || gc.stations !== undefined) ? deviceCounts.PC : gc.pcCount;
  const totalConsoleDevices = deviceCounts
    ? deviceCounts['PLAYSTATION 4'] + deviceCounts['PLAYSTATION 5'] + deviceCounts.XBOX + deviceCounts.SWITCH + deviceCounts.VR
    : 0;
  const finalConsoleCount = deviceCounts && (totalConsoleDevices > 0 || gc.stations !== undefined)
    ? totalConsoleDevices
    : gc.consoleCount;

  // Resolve discount status
  const hasDiscount = extraData?.hasDiscount !== undefined
    ? extraData.hasDiscount
    : (gc.hasDiscount !== undefined ? gc.hasDiscount : checkHasActiveDiscount(gc));

  // Resolve cover images and banner
  const covers = extraData?.coverImages !== undefined
    ? { coverImages: extraData.coverImages, coverImageUrl: extraData.coverImageUrl ?? (extraData.coverImages[0] ?? null), banner: extraData.coverImageUrl ?? (extraData.coverImages[0] ?? null) }
    : (gc.coverImages !== undefined
      ? { coverImages: gc.coverImages, coverImageUrl: gc.coverImageUrl ?? (gc.coverImages[0] ?? null), banner: gc.banner !== undefined ? gc.banner : (gc.coverImageUrl ?? (gc.coverImages[0] ?? null)) }
      : extractCoverImages(gc.media));

  const resolvedBanner = gc.banner !== undefined ? gc.banner : (covers.banner ?? null);

  // Calculate lowest station hourly price (minimum registered active station price)
  let lowestRate: number | null = null;
  if (extraData?.lowestStationPrice !== undefined && extraData.lowestStationPrice !== null) {
    lowestRate = extraData.lowestStationPrice;
  } else if (stations.length > 0) {
    const activeStationPrices = stations
      .filter((s) => s.isActive !== false && typeof s.hourlyPrice === 'number' && !isNaN(s.hourlyPrice))
      .map((s) => s.hourlyPrice);
    if (activeStationPrices.length > 0) {
      lowestRate = Math.min(...activeStationPrices);
    }
  }

  const effectiveHourlyRate = lowestRate !== null ? lowestRate : gc.hourlyRate;

  // Calculate structured pricing
  const pricing = gc.pricing !== undefined
    ? gc.pricing
    : calculateGamingCenterPricing(effectiveHourlyRate, gc.discounts, gc.discountCampaigns);

  const effectiveHasDiscount = pricing.hasDiscount || hasDiscount;
  const cancellationHours = settings?.cancellationHours ?? 2;
  const cancellationWindowMinutes = resolveCancellationWindowMinutes(settings);
  const allowOnlineBooking = settings?.allowOnlineBooking === true;
  const {
    isBookingTemporarilyClosed,
    bookingClosedUntil,
    activeClosure,
  } = resolveActiveClosureSummary(gc.closures);

  return {
    id: gc.id,
    name: gc.name,
    isActive: gc.isActive,
    slug: gc.slug,
    description: gc.description,
    pcCount: finalPcCount,
    consoleCount: finalConsoleCount,
    ps4: hasPs4,
    ps5: hasPs5,
    pc: hasPc,
    xbox: hasXbox,
    is_open: isOpen,
    hourlyRate: effectiveHourlyRate,
    raiting: avgRating,
    rating: avgRating,
    comment_count: commentCount > 0 ? commentCount : count,
    createdAt: gc.createdAt,
    updatedAt: gc.updatedAt,
    addresses,
    hasDiscount: effectiveHasDiscount,
    has_discount: effectiveHasDiscount,
    coverImages: covers.coverImages,
    coverImageUrl: covers.coverImageUrl,
    banner: resolvedBanner,
    pricing,
    cancellationHours,
    cancellationWindowMinutes,
    allowOnlineBooking,
    isBookingTemporarilyClosed,
    bookingClosedUntil,
    activeClosure,
    ...(manager
      ? {
        owner: {
          id: manager.id,
          fullName: manager.fullName,
          role: manager.role,
          type: 'USER' as const,
        },
      }
      : {}),
    ...(deviceCounts ? { deviceCounts } : {}),
  };
}

export const gamingCenterRepository = {
  async transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(callback);
  },

  async findUserById(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.user.findUnique({
      where: { id },
      include: {
        gamingCenter: true,
      },
    });
  },

  async findPlatformAdminById(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.platformAdmin.findUnique({
      where: { id },
    });
  },

  async create(data: CreateGamingCenterInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const createData: Prisma.GamingCenterCreateInput = {
      name: data.name,
      slug: data.slug,
      games: data.games || [],
    };
    return client.gamingCenter.create({
      data: createData,
    });
  },

  async updateUserGamingCenter(
    userId: string,
    gamingCenterId: string,
    data?: Partial<Prisma.UserUncheckedUpdateInput>,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const updateData: Prisma.UserUncheckedUpdateInput = {
      gamingCenterId,
      ...data,
    };
    return client.user.update({
      where: { id: userId },
      data: updateData,
    });
  },

  async createUser(
    data: Prisma.UserUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.user.create({
      data,
    });
  },

  async findById(id: string, options?: GetGamingCenterDetailsQuery): Promise<GamingCenterListItem | Record<string, unknown> | null> {
    const isCustomSelection = Boolean(options && (options.include !== undefined || options.fields !== undefined));

    const resolveHistoricalSlug = async (): Promise<string | null> => {
      if (typeof prisma.gamingCenterSlugHistory?.findUnique !== 'function') {
        return null;
      }
      const history = await Promise.resolve(
        prisma.gamingCenterSlugHistory.findUnique({
          where: { slug: id },
          select: { gamingCenterId: true },
        })
      ).catch(() => null);
      return history && history.gamingCenterId !== id ? history.gamingCenterId : null;
    };

    if (!isCustomSelection) {
      const now = new Date();
      const gc = await prisma.gamingCenter.findFirst({
        where: {
          OR: [
            { id },
            { slug: id },
          ],
          isActive: true,
          verificationStatus: GamingCenterVerificationStatus.APPROVED,
        },
        include: {
          addresses: true,
          stations: {
            select: {
              id: true,
              stationType: true,
              name: true,
              hourlyPrice: true,
              isActive: true,
            },
          },
          settings: {
            select: {
              workStartTime: true,
              workEndTime: true,
              timeZone: true,
              cancellationHours: true,
              cancellationWindowMinutes: true,
              allowOnlineBooking: true,
            },
          },
          manager: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
          media: {
            where: {
              isActive: true,
            },
            orderBy: {
              sortOrder: 'asc',
            },
            select: {
              url: true,
              thumbUrl: true,
              purpose: true,
              isActive: true,
              sortOrder: true,
            },
          },
          discounts: {
            where: {
              isActive: true,
              startAt: { lte: now },
              endAt: { gte: now },
            },
          },
          discountCampaigns: {
            where: {
              isActive: true,
              deletedAt: null,
              startAt: { lte: now },
              endAt: { gte: now },
              OR: [
                { status: 'ACTIVE' },
                { status: null },
              ],
            },
          },
          closures: {
            where: {
              startDate: { lte: now },
              endDate: { gt: now },
            },
            orderBy: {
              endDate: 'desc',
            },
          },
          ...(typeof prisma.gamingCenterSchedule?.findMany === 'function'
            ? {
                schedules: {
                  select: {
                    dayOfWeek: true,
                    startTime: true,
                    endTime: true,
                    isClosed: true,
                  },
                },
              }
            : {}),
        },
      });

      if (!gc) {
        const historicalId = await resolveHistoricalSlug();
        if (historicalId) {
          return this.findById(historicalId, options);
        }
        return null;
      }

      let ratingSummary: { avgRating: number; count: number; commentCount: number } | undefined;
      const rawRatings = (gc as GamingCenterWithRelations).ratings;
      if (!Array.isArray(rawRatings) && typeof prisma.rating?.aggregate === 'function') {
        try {
          const agg = await prisma.rating.aggregate({
            where: {
              gamingCenterId: gc.id,
              status: 'PUBLISHED',
            },
            _avg: {
              rating: true,
            },
            _count: {
              _all: true,
              comment: true,
            },
          });
          if (agg && agg._count) {
            const totalRatings = agg._count._all ?? 0;
            const rawAvg = agg._avg?.rating;
            const avgRating = typeof rawAvg === 'number' ? Math.round(rawAvg * 10) / 10 : 0;
            const commentCount = agg._count.comment ?? totalRatings;
            ratingSummary = { avgRating, count: totalRatings, commentCount };
          }
        } catch {
          // Fallback cleanly in partial unit test mocks
        }
      }

      return transformGamingCenter(
        gc,
        undefined,
        ratingSummary ? { ratingSummary } : undefined
      );
    }

    // Build targeted include or select
    const includeRelations = options?.include;
    const selectFields = options?.fields;

    const includeClause: Prisma.GamingCenterInclude = {};
    if (includeRelations && includeRelations.length > 0) {
      if (includeRelations.includes('addresses')) includeClause.addresses = true;
      if (includeRelations.includes('stations')) includeClause.stations = true;
      if (includeRelations.includes('ratings')) includeClause.ratings = true;
      if (includeRelations.includes('settings')) includeClause.settings = true;
      if (includeRelations.includes('media')) includeClause.media = true;
      if (includeRelations.includes('discounts')) includeClause.discounts = true;
    }

    if (selectFields && selectFields.length > 0) {
      // Use Prisma select
      const selectClause: Prisma.GamingCenterSelect = {
        id: true, // Always include primary identifier
      };
      for (const field of selectFields) {
        (selectClause as Record<string, boolean>)[field] = true;
      }
      if (includeRelations && includeRelations.length > 0) {
        if (includeRelations.includes('addresses')) selectClause.addresses = true;
        if (includeRelations.includes('stations')) selectClause.stations = true;
        if (includeRelations.includes('ratings')) selectClause.ratings = true;
        if (includeRelations.includes('settings')) selectClause.settings = true;
        if (includeRelations.includes('media')) selectClause.media = true;
        if (includeRelations.includes('discounts')) selectClause.discounts = true;
      }

      const gc = await prisma.gamingCenter.findFirst({
        where: {
          OR: [
            { id },
            { slug: id },
          ],
          isActive: true,
          verificationStatus: GamingCenterVerificationStatus.APPROVED,
        },
        select: selectClause,
      });

      if (!gc) {
        const historicalId = await resolveHistoricalSlug();
        if (historicalId) {
          return this.findById(historicalId, options);
        }
        return null;
      }

      return gc as Record<string, unknown>;
    }

    // Only includes were customized, select all base scalar fields of gamingCenter
    const gc = await prisma.gamingCenter.findFirst({
      where: {
        OR: [
          { id },
          { slug: id },
        ],
        isActive: true,
        verificationStatus: GamingCenterVerificationStatus.APPROVED,
      },
      include: Object.keys(includeClause).length > 0 ? includeClause : undefined,
    });

    if (!gc) {
      const historicalId = await resolveHistoricalSlug();
      if (historicalId) {
        return this.findById(historicalId, options);
      }
      return null;
    }

    return gc as Record<string, unknown>;
  },

  async findBySlug(slug: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenter.findFirst({
      where: { slug, isActive: true },
    });
  },

  async findAll(query: ListGamingCentersQuery) {
    const {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      city,
      province,
      district,
      neighborhood,
      game,
      gameId,
      gameSlug,
      playMode,
      stationType,
      type,
      minStationCount,
      minHourlyRate,
      maxHourlyRate,
      minPrice,
      maxPrice,
      hasFoodService,
      isVip,
      amenities,
      minRating,
      isOpen,
      availableNow,
      lat,
      lng,
      radiusKm,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);
    const resolvedDistrict = neighborhood || district;

    // Security invariant: public /api/v1/gamingCenters strictly exposes ONLY active, approved centers.
    const andConditions: Prisma.GamingCenterWhereInput[] = [];
    const where: Prisma.GamingCenterWhereInput = {
      isActive: true,
      verificationStatus: GamingCenterVerificationStatus.APPROVED,
    };

    if (search) {
      const variants = buildPersianArabicSearchVariants(search);
      where.OR = variants.flatMap((v) => [
        { name: { contains: v, mode: 'insensitive' as const } },
        { slug: { contains: v, mode: 'insensitive' as const } },
        { addresses: { some: { city: { contains: v, mode: 'insensitive' as const } } } },
        { addresses: { some: { district: { contains: v, mode: 'insensitive' as const } } } },
      ]);
    }

    // Geographic / address filtering directly in database with Persian/Arabic variants
    if (city || province || resolvedDistrict) {
      const addressAnd: Prisma.AddressWhereInput[] = [];
      if (city) {
        const variants = buildPersianArabicSearchVariants(city);
        addressAnd.push(
          variants.length <= 1
            ? { city: { contains: variants[0] ?? city, mode: 'insensitive' } }
            : { OR: variants.map((v) => ({ city: { contains: v, mode: 'insensitive' } })) }
        );
      }
      if (province) {
        const variants = buildPersianArabicSearchVariants(province);
        addressAnd.push(
          variants.length <= 1
            ? { province: { contains: variants[0] ?? province, mode: 'insensitive' } }
            : { OR: variants.map((v) => ({ province: { contains: v, mode: 'insensitive' } })) }
        );
      }
      if (resolvedDistrict) {
        const variants = buildPersianArabicSearchVariants(resolvedDistrict);
        addressAnd.push(
          variants.length <= 1
            ? { district: { contains: variants[0] ?? resolvedDistrict, mode: 'insensitive' } }
            : { OR: variants.map((v) => ({ district: { contains: v, mode: 'insensitive' } })) }
        );
      }
      where.addresses = {
        some: addressAnd.length === 1 ? addressAnd[0] : { AND: addressAnd },
      };
    }

    if (lat !== undefined && lng !== undefined) {
      const box = getGeoBoundingBox(lat, lng, radiusKm ?? 50);
      andConditions.push({
        addresses: {
          some: {
            lat: { gte: box.minLat, lte: box.maxLat },
            lng: { gte: box.minLng, lte: box.maxLng },
          },
        },
      });
    }

    if (hasFoodService !== undefined) {
      where.hasFoodService = hasFoodService;
    }

    if (isVip === true) {
      andConditions.push({
        OR: [
          { vipHourlyRate: { not: null } },
          { stations: { some: { isActive: true, isVip: true } } },
        ],
      });
    }

    if (amenities && amenities.length > 0) {
      for (const amenity of amenities) {
        switch (amenity) {
          case 'food_service':
            where.hasFoodService = true;
            break;
          case 'vip':
            andConditions.push({
              OR: [
                { vipHourlyRate: { not: null } },
                { stations: { some: { isActive: true, isVip: true } } },
              ],
            });
            break;
          case 'online_booking':
            andConditions.push({ settings: { allowOnlineBooking: true } });
            break;
          case 'online_games':
            if (typeof prisma.gamingCenterGame?.findMany === 'function') {
              andConditions.push({ centerGames: { some: { playMode: GamePlayMode.ONLINE } } });
            }
            break;
          case 'extra_controllers':
            andConditions.push({ stationExtraControllers: { some: { isActive: true } } });
            break;
        }
      }
    }

    const effectiveMinRate = minHourlyRate !== undefined ? minHourlyRate : minPrice;
    const effectiveMaxRate = maxHourlyRate !== undefined ? maxHourlyRate : maxPrice;

    // Filter by station types
    const resolvedStationType = stationType || type;
    if (resolvedStationType) {
      where.stations = {
        some: {
          stationType: resolvedStationType,
          isActive: true,
        },
      };
    }

    // Resolve game filter via catalog/aliases when game, gameId, or gameSlug is specified
    const hasGameFilter = Boolean(game || gameId || gameSlug);
    const resolvedGames = hasGameFilter
      ? await resolveMatchingGames(game, {
          gameIds: gameId ? [gameId] : undefined,
          gameSlug,
          minScore: 55,
        })
      : [];

    if (hasGameFilter && resolvedGames.length === 0 && typeof prisma.gameCatalog?.findMany === 'function') {
      // Fallback: if catalog table is empty in legacy tests, don't crash; if catalog exists and didn't match, return empty
      const totalCatalogCount =
        typeof prisma.gameCatalog?.count === 'function'
          ? await prisma.gameCatalog.count().catch(() => 0)
          : 0;
      if (totalCatalogCount > 0) {
        return formatPaginatedResult([], 0, page, limit);
      }
    }

    if (hasGameFilter && resolvedGames.length > 0) {
      const gameIds = resolvedGames.map((g) => g.game.id);
      const hasCenterGames = typeof prisma.gamingCenterGame?.findMany === 'function';
      const hasStationGames = typeof prisma.gameStationGame?.findMany === 'function';
      const gameOr: Prisma.GamingCenterWhereInput[] = [];
      if (hasCenterGames) {
        gameOr.push({ centerGames: { some: { gameCatalogId: { in: gameIds } } } });
      }
      if (hasStationGames) {
        gameOr.push({
          stations: {
            some: {
              isActive: true,
              stationGames: { some: { gameCatalogId: { in: gameIds }, isActive: true } },
            },
          },
        });
      }
      if (gameOr.length > 0) {
        andConditions.push({ OR: gameOr });
      }
    } else if (hasGameFilter && game && resolvedGames.length === 0) {
      // Legacy fallback only when GameCatalog is unavailable/empty
      where.games = { has: game };
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const needsPostDbEvaluation = Boolean(
      isOpen !== undefined ||
        availableNow === true ||
        minStationCount !== undefined ||
        (minRating !== undefined && minRating > 0) ||
        effectiveMinRate !== undefined ||
        effectiveMaxRate !== undefined ||
        hasGameFilter ||
        isVip !== undefined ||
        (lat !== undefined && lng !== undefined) ||
        (amenities && amenities.length > 0) ||
        sortBy === 'rating' ||
        sortBy === 'bayesian' ||
        sortBy === 'distance' ||
        sortBy === 'hourlyRate'
    );

    // Sorting
    const allowedSortFields: Record<string, boolean> = {
      createdAt: true,
      updatedAt: true,
      name: true,
      hourlyRate: true,
      pcCount: true,
      consoleCount: true,
    };
    const orderField = sortBy && allowedSortFields[sortBy] ? sortBy : 'createdAt';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const now = new Date();
    const hasSchedules = typeof prisma.gamingCenterSchedule?.findMany === 'function';
    const hasCenterGames = typeof prisma.gamingCenterGame?.findMany === 'function';
    const hasStationGames = typeof prisma.gameStationGame?.findMany === 'function';

    const includeClause: Prisma.GamingCenterInclude = {
      addresses: true,
      settings: {
        select: {
          workStartTime: true,
          workEndTime: true,
          timeZone: true,
          cancellationHours: true,
          cancellationWindowMinutes: true,
          allowOnlineBooking: true,
        },
      },
      manager: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
      media: {
        where: {
          isActive: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
        select: {
          url: true,
          thumbUrl: true,
          purpose: true,
          isActive: true,
          sortOrder: true,
        },
      },
      discounts: {
        where: {
          isActive: true,
          startAt: { lte: now },
          endAt: { gte: now },
        },
      },
      discountCampaigns: {
        where: {
          isActive: true,
          deletedAt: null,
          startAt: { lte: now },
          endAt: { gte: now },
          OR: [{ status: 'ACTIVE' }, { status: null }],
        },
      },
      closures: {
        where: {
          startDate: { lte: now },
          endDate: { gt: now },
        },
        orderBy: {
          endDate: 'desc',
        },
      },
      ...(hasSchedules
        ? {
            schedules: {
              select: {
                dayOfWeek: true,
                startTime: true,
                endTime: true,
                isClosed: true,
              },
            },
          }
        : {}),
      ...(needsPostDbEvaluation
        ? {
            stations: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                stationType: true,
                hourlyPrice: true,
                isVip: true,
                isActive: true,
                ...(hasStationGames
                  ? {
                      stationGames: {
                        where: { isActive: true },
                        select: {
                          gameCatalogId: true,
                          playMode: true,
                          isActive: true,
                        },
                      },
                    }
                  : {}),
              },
            },
            ...(hasCenterGames
              ? {
                  centerGames: {
                    select: {
                      gameCatalogId: true,
                      playMode: true,
                      platforms: true,
                    },
                  },
                }
              : {}),
            stationExtraControllers: {
              where: { isActive: true },
              take: 1,
              select: { id: true },
            },
          }
        : {}),
    };

    const [rawCenters, totalFromDb] = await Promise.all([
      prisma.gamingCenter.findMany({
        where,
        ...(needsPostDbEvaluation ? {} : { skip, take }),
        orderBy: { [orderField]: orderDirection },
        include: includeClause,
      }),
      needsPostDbEvaluation ? Promise.resolve(0) : prisma.gamingCenter.count({ where }),
    ]);

    const centerIds = rawCenters.map((c) => c.id);

    let groupedCounts: Array<{ gamingCenterId: string; stationType: string; _count: { _all: number }; _min?: { hourlyPrice?: number | null } }> = [];
    let hasGroupResults = false;
    const minPricesMap = new Map<string, number>();

    const ratingsSummaryMap = new Map<string, { avgRating: number; count: number; commentCount: number }>();
    const ratingAggregateForBayesian = new Map<string, { sumRatings: number; validReviewsCount: number; latestReviewAt: Date | null }>();
    let hasRatingGroupResults = false;

    const shouldGroupStations = centerIds.length > 0 && typeof prisma.gameStation?.groupBy === 'function';
    const shouldGroupRatings = centerIds.length > 0 && typeof prisma.rating?.groupBy === 'function';

    const safeGroupBy = async <T>(fn: () => Promise<T> | undefined): Promise<T | null> => {
      try {
        return (await fn()) ?? null;
      } catch {
        return null;
      }
    };

    const [stationGroupRes, ratingGroupRes] = await Promise.all([
      shouldGroupStations
        ? safeGroupBy(() =>
          prisma.gameStation.groupBy({
            by: ['gamingCenterId', 'stationType'],
            where: {
              gamingCenterId: { in: centerIds },
              isActive: true,
            },
            _count: {
              _all: true,
            },
            _min: {
              hourlyPrice: true,
            },
          })
        )
        : Promise.resolve(null),
      shouldGroupRatings
        ? safeGroupBy(() =>
          prisma.rating.groupBy({
            by: ['gamingCenterId'],
            where: {
              gamingCenterId: { in: centerIds },
              status: 'PUBLISHED',
              reservation: { status: 'COMPLETED' },
            },
            _avg: {
              rating: true,
            },
            _count: {
              _all: true,
              comment: true,
            },
          })
        )
        : Promise.resolve(null),
    ]);

    if (Array.isArray(stationGroupRes)) {
      groupedCounts = stationGroupRes;
      hasGroupResults = stationGroupRes.length > 0;
      for (const item of stationGroupRes) {
        const minPriceVal = item._min?.hourlyPrice;
        if (typeof minPriceVal === 'number') {
          const currentMin = minPricesMap.get(item.gamingCenterId);
          if (currentMin === undefined || minPriceVal < currentMin) {
            minPricesMap.set(item.gamingCenterId, minPriceVal);
          }
        }
      }
    }

    if (Array.isArray(ratingGroupRes)) {
      hasRatingGroupResults = true;
      for (const item of ratingGroupRes) {
        const totalRatings = item._count?._all ?? 0;
        const rawAvg = item._avg?.rating;
        const avgRating = typeof rawAvg === 'number' ? Math.round(rawAvg * 10) / 10 : 0;
        const commentCount = item._count?.comment ?? totalRatings;
        ratingsSummaryMap.set(item.gamingCenterId, {
          avgRating,
          count: totalRatings,
          commentCount,
        });
        ratingAggregateForBayesian.set(item.gamingCenterId, {
          sumRatings: (typeof rawAvg === 'number' ? rawAvg : 0) * totalRatings,
          validReviewsCount: totalRatings,
          latestReviewAt: null,
        });
      }
    }

    const countsMap = new Map<string, DeviceTypeCounts>();
    for (const id of centerIds) {
      countsMap.set(id, {
        PC: 0,
        'PLAYSTATION 4': 0,
        'PLAYSTATION 5': 0,
        XBOX: 0,
        SWITCH: 0,
        VR: 0,
      });
    }

    for (const group of groupedCounts) {
      const centerCounts = countsMap.get(group.gamingCenterId);
      const publicKey = toPublicStationType(group.stationType);
      if (centerCounts && publicKey in centerCounts) {
        (centerCounts as unknown as Record<string, number>)[publicKey] = group._count?._all ?? 0;
      }
    }

    const { globalAverageC } = computeGlobalAverageC(Array.from(ratingAggregateForBayesian.values()));

    let enrichedEntries = rawCenters.map((gc) => {
      const typedGc = gc as unknown as GamingCenterWithRelations;
      const deviceCounts = hasGroupResults ? countsMap.get(gc.id) : undefined;
      const lowestStationPrice = minPricesMap.get(gc.id) ?? null;
      const rawRatings = typedGc.ratings;
      const ratingSummary =
        hasRatingGroupResults && !Array.isArray(rawRatings)
          ? (ratingsSummaryMap.get(gc.id) ?? { avgRating: 0, count: 0, commentCount: 0 })
          : undefined;
      const dto = transformGamingCenter(typedGc, deviceCounts, {
        lowestStationPrice,
        ...(ratingSummary ? { ratingSummary } : {}),
      });

      const primaryAddress =
        (typedGc.addresses || []).find((a) => a.isPrimary) ?? (typedGc.addresses || [])[0] ?? null;
      const distanceKm =
        lat !== undefined &&
        lng !== undefined &&
        primaryAddress &&
        isValidCoordinatePair(primaryAddress.lat, primaryAddress.lng)
          ? calculateHaversineDistanceKm(
              lat,
              lng,
              Number(primaryAddress.lat),
              Number(primaryAddress.lng)
            )
          : null;

      return { raw: typedGc, dto, distanceKm };
    });

    if (needsPostDbEvaluation) {
      enrichedEntries = enrichedEntries.filter(({ raw, dto, distanceKm }) => {
        // Real average rating check
        if (minRating !== undefined && minRating > 0 && (dto.rating ?? dto.raiting ?? 0) < minRating) {
          return false;
        }

        // Effective discounted price check
        const effectivePrice = dto.pricing?.finalPrice ?? dto.hourlyRate;
        if (effectiveMinRate !== undefined && effectivePrice < effectiveMinRate) {
          return false;
        }
        if (effectiveMaxRate !== undefined && effectivePrice > effectiveMaxRate) {
          return false;
        }

        // Minimum station count check (works with or without stationType)
        if (minStationCount !== undefined) {
          if (resolvedStationType) {
            const count = dto.deviceCounts
              ? (dto.deviceCounts as unknown as Record<string, number>)[toPublicStationType(resolvedStationType)] ?? 0
              : (raw.stations || []).filter(
                  (s) => s.isActive !== false && s.stationType === resolvedStationType
                ).length;
            if (count < minStationCount) return false;
          } else {
            const totalActive = (raw.stations || []).filter((s) => s.isActive !== false).length;
            const fallbackTotal = dto.pcCount + dto.consoleCount;
            if ((raw.stations ? totalActive : fallbackTotal) < minStationCount) return false;
          }
        }

        // Accurate isOpen / availableNow check
        if (isOpen !== undefined && dto.is_open !== isOpen) {
          return false;
        }
        if (availableNow === true && (!dto.is_open || !dto.allowOnlineBooking)) {
          return false;
        }

        // isVip exact check
        if (isVip !== undefined) {
          const hasVip =
            raw.vipHourlyRate !== null ||
            (raw.stations || []).some((s) => s.isActive !== false && s.isVip === true);
          if (hasVip !== isVip) return false;
        }

        // Geo distance check
        if (lat !== undefined && lng !== undefined) {
          if (distanceKm === null) return false;
          if (radiusKm !== undefined && distanceKm > radiusKm) return false;
        }

        // Real game + compatible active station check
        if (hasGameFilter && resolvedGames.length > 0) {
          const hasAnyGame = resolvedGames.some((gm) =>
            Boolean(
              resolveCenterGameStations(raw as unknown as Parameters<typeof resolveCenterGameStations>[0], gm, {
                deviceTypes: resolvedStationType ? [resolvedStationType] : undefined,
                playMode,
                allowOnlineBooking: dto.allowOnlineBooking,
                isTemporarilyClosed: Boolean(dto.isBookingTemporarilyClosed),
                now,
              })
            )
          );
          if (!hasAnyGame) return false;
        }

        return true;
      });

      // Apply computed sorting before slicing pagination
      if (sortBy === 'rating') {
        enrichedEntries.sort((a, b) =>
          orderDirection === 'asc'
            ? (a.dto.rating ?? 0) - (b.dto.rating ?? 0)
            : (b.dto.rating ?? 0) - (a.dto.rating ?? 0)
        );
      } else if (sortBy === 'bayesian') {
        enrichedEntries.sort((a, b) => {
          const aAgg = ratingAggregateForBayesian.get(a.dto.id);
          const bAgg = ratingAggregateForBayesian.get(b.dto.id);
          const aScore = computeBayesianScore(
            a.dto.rating ?? 0,
            aAgg?.validReviewsCount ?? 0,
            env.RANKING_BAYESIAN_M,
            globalAverageC
          );
          const bScore = computeBayesianScore(
            b.dto.rating ?? 0,
            bAgg?.validReviewsCount ?? 0,
            env.RANKING_BAYESIAN_M,
            globalAverageC
          );
          return orderDirection === 'asc' ? aScore - bScore : bScore - aScore;
        });
      } else if (sortBy === 'distance' && lat !== undefined && lng !== undefined) {
        enrichedEntries.sort((a, b) => {
          const dA = a.distanceKm ?? Number.POSITIVE_INFINITY;
          const dB = b.distanceKm ?? Number.POSITIVE_INFINITY;
          return orderDirection === 'desc' ? dB - dA : dA - dB;
        });
      } else if (sortBy === 'hourlyRate') {
        enrichedEntries.sort((a, b) => {
          const pA = a.dto.pricing?.finalPrice ?? a.dto.hourlyRate;
          const pB = b.dto.pricing?.finalPrice ?? b.dto.hourlyRate;
          return orderDirection === 'asc' ? pA - pB : pB - pA;
        });
      }

      const totalFiltered = enrichedEntries.length;
      const paged = enrichedEntries.slice(skip, skip + take).map((e) => e.dto);
      return formatPaginatedResult(paged, totalFiltered, page, limit);
    }

    const data = enrichedEntries.map((e) => e.dto);
    return formatPaginatedResult(data, totalFromDb, page, limit);
  },

  async update(id: string, data: UpdateGamingCenterInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenter.update({
      where: { id },
      data,
    });
  },

  async softDelete(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenter.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
