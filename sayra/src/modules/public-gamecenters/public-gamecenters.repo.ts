import {
  CampaignStatus,
  GamePlayMode,
  GamingCenterVerificationStatus,
  Prisma,
  RatingStatus,
  ReservationStatus,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { toPublicStationType } from '../../common/utils/station-type';
import { formatPaginatedResult, getPaginationParams } from '../../common/utils/pagination';
import {
  calculateGamingCenterPricing,
  checkIsOpen,
  extractCoverImages,
} from '../gamingCenter/gamingCenter.repository';
import { resolveActiveClosureSummary } from '../closures/closures.validators';
import {
  CenterRatingAggregate,
  computeBayesianScore,
  computeGlobalAverageC,
  rankPublicGameCenters,
} from './bayesian.ranking';
import {
  PublicAmenityKey,
  PublicGameCenterDeviceCountsDto,
  PublicGameCenterDeviceSummaryDto,
  PublicGameCenterDto,
  PublicGameCenterRankingsResponseDto,
} from './public-gamecenters.types';
import {
  ListPublicGameCentersQuery,
  PublicGameCentersRankingsQuery,
} from './public-gamecenters.validation';

interface RawCenterRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  verificationStatus: GamingCenterVerificationStatus;
  pcCount: number;
  consoleCount: number;
  openingTime: string | null;
  closingTime: string | null;
  timezone: string;
  hourlyRate: number;
  vipHourlyRate: number | null;
  hasFoodService: boolean;
  games: string[];
  createdAt: Date;
  updatedAt: Date;
  addresses: Array<{
    province: string | null;
    city: string;
    district: string | null;
    addressLine: string;
    lat: Prisma.Decimal | number | null;
    lng: Prisma.Decimal | number | null;
    isPrimary: boolean;
    createdAt: Date;
  }>;
  stations: Array<{
    id: string;
    stationType: string;
    name: string;
    hourlyPrice: number;
    isVip: boolean;
    isActive: boolean;
  }>;
  settings: {
    workStartTime: string | null;
    workEndTime: string | null;
    timeZone: string | null;
    allowOnlineBooking: boolean;
  } | null;
  media: Array<{
    url: string;
    thumbUrl: string | null;
    altText: string | null;
    purpose: string;
    isActive: boolean;
    sortOrder: number;
  }>;
  discounts: Array<{
    isActive: boolean;
    valueType: string;
    value: number;
    startAt: Date;
    endAt: Date;
  }>;
  discountCampaigns: Array<{
    isActive: boolean;
    discountType: string | null;
    discountValue: number | null;
    maxDiscountAmount: number | null;
    status: string | null;
    deletedAt: Date | null;
    startAt: Date;
    endAt: Date;
  }>;
  closures: Array<{
    id: string;
    title: string | null;
    reason: string | null;
    startDate: Date;
    endDate: Date;
  }>;
  centerGames?: Array<{ id: string }>;
  stationExtraControllers?: Array<{ id: string }>;
}

const FRONTEND_BASE_URL = (
  process.env.SITE_PUBLIC_URL ||
  env.FRONTEND_URL ||
  'https://www.sayra-booking.ir'
).replace(/\/+$/, '');

function buildPublicEligibilityWhere(
  extra: Prisma.GamingCenterWhereInput = {}
): Prisma.GamingCenterWhereInput {
  return {
    ...extra,
    isActive: true,
    verificationStatus: GamingCenterVerificationStatus.APPROVED,
  };
}

function buildFilterConditions(params: {
  city?: string;
  neighborhood?: string;
  district?: string;
  deviceType?: string;
  amenities?: PublicAmenityKey[];
  search?: string;
}): Prisma.GamingCenterWhereInput {
  const andConditions: Prisma.GamingCenterWhereInput[] = [];
  const resolvedNeighborhood = params.neighborhood || params.district;

  if (params.city || resolvedNeighborhood) {
    andConditions.push({
      addresses: {
        some: {
          ...(params.city ? { city: { contains: params.city, mode: 'insensitive' } } : {}),
          ...(resolvedNeighborhood
            ? { district: { contains: resolvedNeighborhood, mode: 'insensitive' } }
            : {}),
        },
      },
    });
  }

  if (params.deviceType) {
    andConditions.push({
      stations: {
        some: {
          isActive: true,
          stationType: params.deviceType as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        },
      },
    });
  }

  if (params.search) {
    andConditions.push({
      OR: [
        { name: { contains: params.search, mode: 'insensitive' } },
        { slug: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        {
          addresses: {
            some: {
              OR: [
                { city: { contains: params.search, mode: 'insensitive' } },
                { district: { contains: params.search, mode: 'insensitive' } },
                { addressLine: { contains: params.search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    });
  }

  if (Array.isArray(params.amenities) && params.amenities.length > 0) {
    for (const amenity of params.amenities) {
      switch (amenity) {
        case 'food_service':
          andConditions.push({ hasFoodService: true });
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
          andConditions.push({ centerGames: { some: { playMode: 'ONLINE' } } });
          break;
        case 'extra_controllers':
          andConditions.push({ stationExtraControllers: { some: { isActive: true } } });
          break;
      }
    }
  }

  if (andConditions.length === 0) {
    return buildPublicEligibilityWhere();
  }

  return buildPublicEligibilityWhere({ AND: andConditions });
}

function buildCenterInclude(now: Date): Prisma.GamingCenterInclude {
  return {
    addresses: {
      orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
      select: {
        province: true,
        city: true,
        district: true,
        addressLine: true,
        lat: true,
        lng: true,
        isPrimary: true,
        createdAt: true,
      },
    },
    stations: {
      where: { isActive: true },
      select: {
        id: true,
        stationType: true,
        name: true,
        hourlyPrice: true,
        isVip: true,
        isActive: true,
      },
    },
    settings: {
      select: {
        workStartTime: true,
        workEndTime: true,
        timeZone: true,
        allowOnlineBooking: true,
      },
    },
    media: {
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' as const },
      select: {
        url: true,
        thumbUrl: true,
        altText: true,
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
      select: {
        isActive: true,
        valueType: true,
        value: true,
        startAt: true,
        endAt: true,
      },
    },
    discountCampaigns: {
      where: {
        isActive: true,
        deletedAt: null,
        startAt: { lte: now },
        endAt: { gte: now },
        OR: [{ status: CampaignStatus.ACTIVE }, { status: null }],
      },
      select: {
        isActive: true,
        discountType: true,
        discountValue: true,
        maxDiscountAmount: true,
        status: true,
        deletedAt: true,
        startAt: true,
        endAt: true,
      },
    },
    closures: {
      where: {
        startDate: { lte: now },
        endDate: { gt: now },
      },
      orderBy: { endDate: 'desc' as const },
      select: {
        id: true,
        title: true,
        reason: true,
        startDate: true,
        endDate: true,
      },
    },
    centerGames: {
      where: { playMode: GamePlayMode.ONLINE },
      take: 1,
      select: { id: true },
    },
    stationExtraControllers: {
      where: { isActive: true },
      take: 1,
      select: { id: true },
    },
  };
}

/**
 * Fetches valid ratings (PUBLISHED + linked to COMPLETED reservation) grouped by gamingCenterId.
 */
async function aggregateValidRatings(
  centerIds?: string[]
): Promise<Map<string, CenterRatingAggregate>> {
  const result = new Map<string, CenterRatingAggregate>();
  if (centerIds && centerIds.length === 0) {
    return result;
  }
  if (typeof prisma.rating?.findMany !== 'function') {
    return result;
  }

  const rows = await prisma.rating.findMany({
    where: {
      ...(centerIds ? { gamingCenterId: { in: centerIds } } : {}),
      status: RatingStatus.PUBLISHED,
      reservation: {
        status: ReservationStatus.COMPLETED,
      },
      gamingCenter: {
        isActive: true,
        verificationStatus: GamingCenterVerificationStatus.APPROVED,
      },
    },
    select: {
      gamingCenterId: true,
      rating: true,
      createdAt: true,
    },
  });

  for (const row of rows) {
    if (typeof row.rating !== 'number' || !Number.isFinite(row.rating)) {
      continue;
    }
    const existing = result.get(row.gamingCenterId) ?? {
      sumRatings: 0,
      validReviewsCount: 0,
      latestReviewAt: null,
    };
    existing.sumRatings += row.rating;
    existing.validReviewsCount += 1;
    if (
      row.createdAt &&
      (!existing.latestReviewAt || row.createdAt.getTime() > existing.latestReviewAt.getTime())
    ) {
      existing.latestReviewAt = row.createdAt;
    }
    result.set(row.gamingCenterId, existing);
  }

  return result;
}

function deriveAmenities(gc: RawCenterRecord): PublicAmenityKey[] {
  const amenities: PublicAmenityKey[] = [];
  if (gc.hasFoodService) {
    amenities.push('food_service');
  }
  if (gc.vipHourlyRate !== null && gc.vipHourlyRate !== undefined) {
    amenities.push('vip');
  } else if (gc.stations.some((s) => s.isActive !== false && s.isVip)) {
    amenities.push('vip');
  }
  if (gc.settings?.allowOnlineBooking === true) {
    amenities.push('online_booking');
  }
  if (Array.isArray(gc.centerGames) && gc.centerGames.length > 0) {
    amenities.push('online_games');
  }
  if (Array.isArray(gc.stationExtraControllers) && gc.stationExtraControllers.length > 0) {
    amenities.push('extra_controllers');
  }
  return amenities;
}

function summarizeDevices(gc: RawCenterRecord): {
  devices: PublicGameCenterDeviceSummaryDto[];
  deviceCounts: PublicGameCenterDeviceCountsDto;
  pcCount: number;
  consoleCount: number;
  lowestStationPrice: number | null;
} {
  const counts: PublicGameCenterDeviceCountsDto = {
    PC: 0,
    'PLAYSTATION 4': 0,
    'PLAYSTATION 5': 0,
    XBOX: 0,
    SWITCH: 0,
    VR: 0,
  };

  const summaryByType = new Map<
    string,
    { count: number; minHourlyPrice: number | null; hasVip: boolean }
  >();
  let lowestStationPrice: number | null = null;

  for (const station of gc.stations || []) {
    if (station.isActive === false) continue;

    const publicType = toPublicStationType(station.stationType);
    if (publicType in counts) {
      (counts as unknown as Record<string, number>)[publicType] += 1;
    }

    const entry = summaryByType.get(publicType) ?? {
      count: 0,
      minHourlyPrice: null,
      hasVip: false,
    };
    entry.count += 1;
    if (station.isVip) {
      entry.hasVip = true;
    }
    if (typeof station.hourlyPrice === 'number' && Number.isFinite(station.hourlyPrice)) {
      if (entry.minHourlyPrice === null || station.hourlyPrice < entry.minHourlyPrice) {
        entry.minHourlyPrice = station.hourlyPrice;
      }
      if (lowestStationPrice === null || station.hourlyPrice < lowestStationPrice) {
        lowestStationPrice = station.hourlyPrice;
      }
    }
    summaryByType.set(publicType, entry);
  }

  const devices: PublicGameCenterDeviceSummaryDto[] = Array.from(summaryByType.entries()).map(
    ([type, info]) => ({
      type,
      count: info.count,
      minHourlyPrice: info.minHourlyPrice,
      hasVip: info.hasVip,
    })
  );

  const hasStations = (gc.stations || []).length > 0;
  const pcCount = hasStations ? counts.PC : gc.pcCount;
  const stationConsoleTotal =
    counts['PLAYSTATION 4'] + counts['PLAYSTATION 5'] + counts.XBOX + counts.SWITCH + counts.VR;
  const consoleCount = hasStations ? stationConsoleTotal : gc.consoleCount;

  return {
    devices,
    deviceCounts: counts,
    pcCount,
    consoleCount,
    lowestStationPrice,
  };
}

function toPublicGameCenterDto(
  gc: RawCenterRecord,
  ratingStats: CenterRatingAggregate,
  rankingParams: {
    globalAverageC: number;
    m: number;
    minReviews: number;
    rank?: number | null;
  },
  now: Date = new Date()
): PublicGameCenterDto {
  const primaryAddress =
    (gc.addresses || []).find((a) => a.isPrimary) ?? (gc.addresses || [])[0] ?? null;

  const latNum =
    primaryAddress?.lat !== null && primaryAddress?.lat !== undefined
      ? Number(primaryAddress.lat)
      : null;
  const lngNum =
    primaryAddress?.lng !== null && primaryAddress?.lng !== undefined
      ? Number(primaryAddress.lng)
      : null;
  const coordinates =
    latNum !== null &&
    lngNum !== null &&
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    !(latNum === 0 && lngNum === 0)
      ? { lat: latNum, lng: lngNum }
      : null;

  const activeMedia = (gc.media || []).filter((m) => m.isActive !== false);
  const { coverImageUrl } = extractCoverImages(activeMedia);

  const { devices, deviceCounts, pcCount, consoleCount, lowestStationPrice } = summarizeDevices(gc);
  const startingRate = lowestStationPrice !== null ? lowestStationPrice : gc.hourlyRate;
  const pricing = calculateGamingCenterPricing(
    startingRate,
    gc.discounts,
    gc.discountCampaigns,
    now
  );

  const openTime = gc.settings?.workStartTime || gc.openingTime;
  const closeTime = gc.settings?.workEndTime || gc.closingTime;
  const tz = gc.settings?.timeZone || gc.timezone || 'Asia/Tehran';
  const closureSummary = resolveActiveClosureSummary(gc.closures, now);
  const isOpenNow =
    !closureSummary.isBookingTemporarilyClosed && checkIsOpen(openTime, closeTime, tz, now);

  const v = ratingStats.validReviewsCount;
  const exactR = v > 0 ? ratingStats.sumRatings / v : 0;
  const rawAvg = v > 0 ? Math.round(exactR * 100) / 100 : 0;
  const bayesianScore = computeBayesianScore(
    exactR,
    v,
    rankingParams.m,
    rankingParams.globalAverageC
  );
  const isEligibleForRanking = v > 0 && v >= rankingParams.minReviews;
  const detailUrl = `/gamecenter/${encodeURIComponent(gc.slug)}`;

  return {
    id: gc.id,
    name: gc.name,
    slug: gc.slug,
    description: gc.description ?? null,
    city: primaryAddress?.city?.trim() || null,
    province: primaryAddress?.province?.trim() || null,
    neighborhood: primaryAddress?.district?.trim() || null,
    address: primaryAddress?.addressLine?.trim() || null,
    coordinates,
    images: {
      coverUrl: coverImageUrl,
      gallery: activeMedia.map((m) => ({
        url: m.url,
        thumbUrl: m.thumbUrl ?? null,
        altText: m.altText ?? null,
        purpose: m.purpose,
      })),
    },
    devices,
    deviceCounts,
    pcCount,
    consoleCount,
    amenities: deriveAmenities(gc),
    games: Array.isArray(gc.games) ? gc.games : [],
    pricing: {
      startingHourlyRate: startingRate,
      originalPrice: pricing.originalPrice,
      finalPrice: pricing.finalPrice,
      hasDiscount: pricing.hasDiscount,
      discountPercentage: pricing.discountPercentage,
      discountAmount: pricing.discountAmount,
      currency: 'IRT',
    },
    activityStatus: {
      isActive: true,
      isOpenNow,
      openingTime: openTime ?? null,
      closingTime: closeTime ?? null,
      timezone: tz,
      isTemporarilyClosed: closureSummary.isBookingTemporarilyClosed,
      closedUntil: closureSummary.bookingClosedUntil,
    },
    rating: {
      average: rawAvg,
      validReviewsCount: v,
      latestReviewAt: ratingStats.latestReviewAt ? ratingStats.latestReviewAt.toISOString() : null,
    },
    ranking: {
      bayesianScore,
      rawAverageR: rawAvg,
      validReviewsCountV: v,
      globalAverageC: rankingParams.globalAverageC,
      m: rankingParams.m,
      minReviews: rankingParams.minReviews,
      isEligibleForRanking,
      rank: rankingParams.rank ?? null,
    },
    detailUrl,
    absoluteDetailUrl: `${FRONTEND_BASE_URL}${detailUrl}`,
    updatedAt: gc.updatedAt.toISOString(),
  };
}

export const PublicGameCentersRepo = {
  async findByIdOrSlug(idOrSlug: string): Promise<PublicGameCenterDto | null> {
    const cleanId = idOrSlug.trim();
    if (!cleanId) return null;

    const now = new Date();
    const include = buildCenterInclude(now);

    let gc = (await prisma.gamingCenter.findFirst({
      where: buildPublicEligibilityWhere({
        OR: [{ id: cleanId }, { slug: cleanId }],
      }),
      include,
    })) as unknown as RawCenterRecord | null;

    if (!gc && typeof prisma.gamingCenterSlugHistory?.findUnique === 'function') {
      const history = await prisma.gamingCenterSlugHistory
        .findUnique({
          where: { slug: cleanId },
          select: { gamingCenterId: true },
        })
        .catch(() => null);

      if (history?.gamingCenterId) {
        gc = (await prisma.gamingCenter.findFirst({
          where: buildPublicEligibilityWhere({ id: history.gamingCenterId }),
          include,
        })) as unknown as RawCenterRecord | null;
      }
    }

    if (!gc) {
      return null;
    }

    const [centerRatingsMap, allRatingsMap] = await Promise.all([
      aggregateValidRatings([gc.id]),
      aggregateValidRatings(),
    ]);

    const { globalAverageC } = computeGlobalAverageC(Array.from(allRatingsMap.values()));
    const ratingStats = centerRatingsMap.get(gc.id) ?? {
      sumRatings: 0,
      validReviewsCount: 0,
      latestReviewAt: null,
    };

    return toPublicGameCenterDto(
      gc,
      ratingStats,
      {
        globalAverageC,
        m: env.RANKING_BAYESIAN_M,
        minReviews: env.RANKING_MIN_REVIEWS_DEFAULT,
        rank: null,
      },
      now
    );
  },

  async findMany(query: ListPublicGameCentersQuery) {
    const now = new Date();
    const include = buildCenterInclude(now);
    const m = env.RANKING_BAYESIAN_M;
    const minReviews = env.RANKING_MIN_REVIEWS_DEFAULT;

    // Batch fetch by IDs (used by Django Blog to prevent N+1 calls)
    if (query.ids && query.ids.length > 0) {
      const requestedIds = query.ids;
      const centers = (await prisma.gamingCenter.findMany({
        where: buildPublicEligibilityWhere({
          id: { in: requestedIds },
        }),
        include,
      })) as unknown as RawCenterRecord[];

      const [centerRatingsMap, allRatingsMap] = await Promise.all([
        aggregateValidRatings(centers.map((c) => c.id)),
        aggregateValidRatings(),
      ]);
      const { globalAverageC } = computeGlobalAverageC(Array.from(allRatingsMap.values()));

      const dtoById = new Map<string, PublicGameCenterDto>();
      for (const gc of centers) {
        const stats = centerRatingsMap.get(gc.id) ?? {
          sumRatings: 0,
          validReviewsCount: 0,
          latestReviewAt: null,
        };
        const dto = toPublicGameCenterDto(
          gc,
          stats,
          { globalAverageC, m, minReviews, rank: null },
          now
        );
        dtoById.set(gc.id, dto);
      }

      const ordered = requestedIds
        .map((id) => dtoById.get(id))
        .filter((item): item is PublicGameCenterDto => Boolean(item));

      return formatPaginatedResult(ordered, ordered.length, 1, requestedIds.length);
    }

    const where = buildFilterConditions({
      city: query.city,
      neighborhood: query.neighborhood,
      district: query.district,
      deviceType: query.deviceType,
      amenities: query.amenities,
      search: query.search,
    });

    const isOpenNowFilter = query.status === 'open_now';
    const { skip, take } = getPaginationParams(query.page, query.limit);

    if (isOpenNowFilter) {
      const [rawCenters, allRatingsMap] = await Promise.all([
        prisma.gamingCenter.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          include,
        }) as unknown as Promise<RawCenterRecord[]>,
        aggregateValidRatings(),
      ]);

      const { globalAverageC } = computeGlobalAverageC(Array.from(allRatingsMap.values()));
      const dtos = rawCenters
        .map((gc) => {
          const stats = allRatingsMap.get(gc.id) ?? {
            sumRatings: 0,
            validReviewsCount: 0,
            latestReviewAt: null,
          };
          return toPublicGameCenterDto(
            gc,
            stats,
            { globalAverageC, m, minReviews, rank: null },
            now
          );
        })
        .filter((dto) => dto.activityStatus.isOpenNow);

      const paged = dtos.slice(skip, skip + take);
      return formatPaginatedResult(paged, dtos.length, query.page, query.limit);
    }

    const [rawCenters, total, allRatingsMap] = await Promise.all([
      prisma.gamingCenter.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include,
      }) as unknown as Promise<RawCenterRecord[]>,
      prisma.gamingCenter.count({ where }),
      aggregateValidRatings(),
    ]);

    const { globalAverageC } = computeGlobalAverageC(Array.from(allRatingsMap.values()));
    const dtos = rawCenters.map((gc) => {
      const stats = allRatingsMap.get(gc.id) ?? {
        sumRatings: 0,
        validReviewsCount: 0,
        latestReviewAt: null,
      };
      return toPublicGameCenterDto(
        gc,
        stats,
        { globalAverageC, m, minReviews, rank: null },
        now
      );
    });

    return formatPaginatedResult(dtos, total, query.page, query.limit);
  },

  async getRankings(
    query: PublicGameCentersRankingsQuery
  ): Promise<PublicGameCenterRankingsResponseDto> {
    const now = new Date();
    const m = query.m ?? env.RANKING_BAYESIAN_M;
    const minReviews = query.minReviews ?? env.RANKING_MIN_REVIEWS_DEFAULT;
    const resolvedNeighborhood = query.neighborhood || query.district || null;

    const where = buildFilterConditions({
      city: query.city,
      neighborhood: query.neighborhood,
      district: query.district,
      deviceType: query.deviceType,
      amenities: query.amenities,
    });

    const rawCenters = (await prisma.gamingCenter.findMany({
      where,
      include: buildCenterInclude(now),
    })) as unknown as RawCenterRecord[];

    const scopedIds = rawCenters.map((c) => c.id);
    const [scopedRatingsMap, globalRatingsMap] = await Promise.all([
      aggregateValidRatings(scopedIds),
      aggregateValidRatings(),
    ]);

    const scopedC = computeGlobalAverageC(Array.from(scopedRatingsMap.values()));
    const globalC =
      scopedC.totalValidReviews > 0
        ? scopedC
        : computeGlobalAverageC(Array.from(globalRatingsMap.values()));

    const candidates = rawCenters.map((gc) => {
      const stats = scopedRatingsMap.get(gc.id) ?? {
        sumRatings: 0,
        validReviewsCount: 0,
        latestReviewAt: null,
      };
      const baseDto = toPublicGameCenterDto(
        gc,
        stats,
        {
          globalAverageC: globalC.globalAverageC,
          m,
          minReviews,
          rank: null,
        },
        now
      );

      return {
        id: gc.id,
        isActive: gc.isActive,
        verificationStatus: gc.verificationStatus,
        createdAt: gc.createdAt,
        finalPrice: baseDto.pricing.finalPrice,
        ratingStats: stats,
        dto: baseDto,
        attachRanking: (
          dto: PublicGameCenterDto,
          ranking: NonNullable<PublicGameCenterDto['ranking']>
        ): PublicGameCenterDto => ({
          ...dto,
          ranking,
        }),
      };
    });

    const rankedOutput = rankPublicGameCenters(candidates, {
      m,
      minReviews,
      globalAverageC: globalC.globalAverageC,
      sort: query.sort,
      limit: query.limit,
      includeNewlyRegistered: query.includeNewlyRegistered,
      newlyRegisteredLimit: query.newlyRegisteredLimit,
    });

    return {
      ranked: rankedOutput.ranked,
      newlyRegistered: rankedOutput.newlyRegistered,
      methodology: {
        algorithm: 'bayesian_average',
        formula: '(v / (v + m)) * R + (m / (v + m)) * C',
        m,
        minReviews,
        globalAverageC: globalC.globalAverageC,
        scopeTotalValidReviews: scopedC.totalValidReviews,
        scope: {
          city: query.city ?? null,
          neighborhood: resolvedNeighborhood,
          deviceType: query.deviceType ? toPublicStationType(query.deviceType) : null,
          amenities: query.amenities ?? [],
        },
        sort: query.sort,
        rankedCount: rankedOutput.totalRankedEligible,
        newlyRegisteredCount: rankedOutput.totalNewlyRegistered,
        calculatedAt: now.toISOString(),
      },
    };
  },
};
