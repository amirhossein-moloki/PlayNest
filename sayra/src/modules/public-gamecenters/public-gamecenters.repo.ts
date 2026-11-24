import {
  CampaignStatus,
  GamePlayMode,
  GameStationType,
  GamingCenterVerificationStatus,
  Prisma,
  RatingStatus,
  ReservationStatus,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { toPublicStationType } from '../../common/utils/station-type';
import { formatPaginatedResult, getPaginationParams } from '../../common/utils/pagination';
import { evaluateCenterOpenStatus } from '../../common/utils/operatingHours';
import {
  buildPersianArabicSearchVariants,
  calculateHaversineDistanceKm,
  getGeoBoundingBox,
  isValidCoordinatePair,
} from '../../common/utils/searchText';
import {
  calculateGamingCenterPricing,
  extractCoverImages,
} from '../gamingCenter/gamingCenter.repository';
import { resolveMatchingGames } from '../search/gameIndex.service';
import { resolveCenterGameStations } from '../search/search.service';
import { ResolvedGameMatch } from '../search/search.types';
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
  closedDays?: number[];
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
    stationGames?: Array<{
      gameCatalogId: string;
      playMode: GamePlayMode;
      isActive: boolean;
    }>;
  }>;
  settings: {
    workStartTime: string | null;
    workEndTime: string | null;
    timeZone: string | null;
    allowOnlineBooking: boolean;
  } | null;
  schedules?: Array<{
    dayOfWeek: number;
    startTime: string | null;
    endTime: string | null;
    isClosed: boolean;
  }>;
  media: Array<{
    url: string;
    thumbUrl: string | null;
    altText: string | null;
    purpose: string;
    isActive: boolean;
    sortOrder: number;
  }>;
  discounts: Array<{
    id?: string;
    targetType?: string;
    targetId?: string;
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
  centerGames?: Array<{
    id?: string;
    gameCatalogId?: string;
    playMode?: GamePlayMode;
    platforms?: GameStationType[];
  }>;
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
  province?: string;
  neighborhood?: string;
  district?: string;
  deviceType?: string;
  amenities?: PublicAmenityKey[];
  search?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  resolvedGameIds?: string[];
}): Prisma.GamingCenterWhereInput {
  const andConditions: Prisma.GamingCenterWhereInput[] = [];
  const resolvedNeighborhood = params.neighborhood || params.district;

  if (params.city || params.province || resolvedNeighborhood) {
    const addrAnd: Prisma.AddressWhereInput[] = [];
    if (params.city) {
      const variants = buildPersianArabicSearchVariants(params.city);
      addrAnd.push(
        variants.length <= 1
          ? { city: { contains: variants[0] ?? params.city, mode: 'insensitive' } }
          : { OR: variants.map((v) => ({ city: { contains: v, mode: 'insensitive' } })) }
      );
    }
    if (params.province) {
      const variants = buildPersianArabicSearchVariants(params.province);
      addrAnd.push(
        variants.length <= 1
          ? { province: { contains: variants[0] ?? params.province, mode: 'insensitive' } }
          : { OR: variants.map((v) => ({ province: { contains: v, mode: 'insensitive' } })) }
      );
    }
    if (resolvedNeighborhood) {
      const variants = buildPersianArabicSearchVariants(resolvedNeighborhood);
      addrAnd.push(
        variants.length <= 1
          ? { district: { contains: variants[0] ?? resolvedNeighborhood, mode: 'insensitive' } }
          : { OR: variants.map((v) => ({ district: { contains: v, mode: 'insensitive' } })) }
      );
    }
    andConditions.push({
      addresses: {
        some: addrAnd.length === 1 ? addrAnd[0] : { AND: addrAnd },
      },
    });
  }

  if (params.lat !== undefined && params.lng !== undefined) {
    const box = getGeoBoundingBox(params.lat, params.lng, params.radiusKm ?? 50);
    andConditions.push({
      addresses: {
        some: {
          lat: { gte: box.minLat, lte: box.maxLat },
          lng: { gte: box.minLng, lte: box.maxLng },
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
    const variants = buildPersianArabicSearchVariants(params.search);
    andConditions.push({
      OR: variants.flatMap((v) => [
        { name: { contains: v, mode: 'insensitive' as const } },
        { slug: { contains: v, mode: 'insensitive' as const } },
        { description: { contains: v, mode: 'insensitive' as const } },
        {
          addresses: {
            some: {
              OR: [
                { city: { contains: v, mode: 'insensitive' as const } },
                { district: { contains: v, mode: 'insensitive' as const } },
                { addressLine: { contains: v, mode: 'insensitive' as const } },
              ],
            },
          },
        },
      ]),
    });
  }

  if (params.resolvedGameIds && params.resolvedGameIds.length > 0) {
    const hasCenterGames = typeof prisma.gamingCenterGame?.findMany === 'function';
    const hasStationGames = typeof prisma.gameStationGame?.findMany === 'function';
    const gameOr: Prisma.GamingCenterWhereInput[] = [];
    if (hasCenterGames) {
      gameOr.push({ centerGames: { some: { gameCatalogId: { in: params.resolvedGameIds } } } });
    }
    if (hasStationGames) {
      gameOr.push({
        stations: {
          some: {
            isActive: true,
            stationGames: { some: { gameCatalogId: { in: params.resolvedGameIds }, isActive: true } },
          },
        },
      });
    }
    if (gameOr.length > 0) {
      andConditions.push({ OR: gameOr });
    }
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

function buildCenterInclude(now: Date, includeAllCenterGames = false): Prisma.GamingCenterInclude {
  const hasSchedules = typeof prisma.gamingCenterSchedule?.findMany === 'function';
  const hasStationGames = typeof prisma.gameStationGame?.findMany === 'function';

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
    settings: {
      select: {
        workStartTime: true,
        workEndTime: true,
        timeZone: true,
        allowOnlineBooking: true,
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
        id: true,
        targetType: true,
        targetId: true,
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
    centerGames: includeAllCenterGames
      ? {
          select: {
            id: true,
            gameCatalogId: true,
            playMode: true,
            platforms: true,
          },
        }
      : {
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
  if (
    Array.isArray(gc.centerGames) &&
    gc.centerGames.some((cg) => cg.playMode === undefined || cg.playMode === GamePlayMode.ONLINE)
  ) {
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

  const hasValidCoords = primaryAddress && isValidCoordinatePair(primaryAddress.lat, primaryAddress.lng);
  const coordinates = hasValidCoords
    ? { lat: Number(primaryAddress!.lat), lng: Number(primaryAddress!.lng) }
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

  const openStatus = evaluateCenterOpenStatus({
    openingTime: gc.openingTime,
    closingTime: gc.closingTime,
    closedDays: gc.closedDays,
    timezone: gc.timezone,
    settings: gc.settings,
    schedules: gc.schedules,
    closures: gc.closures,
    now,
  });

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
      isOpenNow: openStatus.isOpenNow,
      openingTime: openStatus.openingTime,
      closingTime: openStatus.closingTime,
      timezone: openStatus.timezone,
      isTemporarilyClosed: openStatus.isTemporarilyClosed,
      closedUntil: openStatus.closedUntil,
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

function filterCentersByGameSupport(
  centers: RawCenterRecord[],
  resolvedGames: ResolvedGameMatch[],
  options: {
    deviceType?: GameStationType;
    playMode?: GamePlayMode;
    now: Date;
  }
): RawCenterRecord[] {
  if (resolvedGames.length === 0) return centers;
  return centers.filter((gc) =>
    resolvedGames.some((gm) =>
      Boolean(
        resolveCenterGameStations(
          gc as unknown as Parameters<typeof resolveCenterGameStations>[0],
          gm,
          {
            deviceTypes: options.deviceType ? [options.deviceType] : undefined,
            playMode: options.playMode,
            allowOnlineBooking: gc.settings?.allowOnlineBooking === true,
            isTemporarilyClosed: evaluateCenterOpenStatus({
              openingTime: gc.openingTime,
              closingTime: gc.closingTime,
              closedDays: gc.closedDays,
              timezone: gc.timezone,
              settings: gc.settings,
              schedules: gc.schedules,
              closures: gc.closures,
              now: options.now,
            }).isTemporarilyClosed,
            now: options.now,
          }
        )
      )
    )
  );
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
    const m = env.RANKING_BAYESIAN_M;
    const minReviews = env.RANKING_MIN_REVIEWS_DEFAULT;

    // Batch fetch by IDs (used by Django Blog to prevent N+1 calls)
    if (query.ids && query.ids.length > 0) {
      const include = buildCenterInclude(now);
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

    const hasGameFilter = Boolean(query.game || query.gameId || query.gameSlug);
    const resolvedGames = hasGameFilter
      ? await resolveMatchingGames(query.game, {
          gameIds: query.gameId ? [query.gameId] : undefined,
          gameSlug: query.gameSlug,
          minScore: 55,
        })
      : [];

    if (hasGameFilter && resolvedGames.length === 0) {
      return formatPaginatedResult([], 0, query.page, query.limit);
    }

    const include = buildCenterInclude(now, hasGameFilter);
    const where = buildFilterConditions({
      city: query.city,
      province: query.province,
      neighborhood: query.neighborhood,
      district: query.district,
      deviceType: query.deviceType,
      amenities: query.amenities,
      search: query.search,
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm,
      resolvedGameIds: resolvedGames.map((g) => g.game.id),
    });

    const isOpenNowFilter = query.status === 'open_now' || query.isOpen === true;
    const isClosedFilter = query.isOpen === false;
    const hasPostDbFilter = Boolean(
      isOpenNowFilter ||
        isClosedFilter ||
        hasGameFilter ||
        query.minPrice !== undefined ||
        query.maxPrice !== undefined ||
        query.minRating !== undefined ||
        (query.lat !== undefined && query.lng !== undefined) ||
        (query.sort && query.sort !== 'newest')
    );

    const { skip, take } = getPaginationParams(query.page, query.limit);

    if (hasPostDbFilter) {
      const [rawCenters, allRatingsMap] = await Promise.all([
        prisma.gamingCenter.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          include,
        }) as unknown as Promise<RawCenterRecord[]>,
        aggregateValidRatings(),
      ]);

      const { globalAverageC } = computeGlobalAverageC(Array.from(allRatingsMap.values()));

      const gameMatchedCenters = hasGameFilter
        ? filterCentersByGameSupport(rawCenters, resolvedGames, {
            deviceType: query.deviceType,
            playMode: query.playMode,
            now,
          })
        : rawCenters;

      const evaluated = gameMatchedCenters
        .map((gc) => {
          const stats = allRatingsMap.get(gc.id) ?? {
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
          const distanceKm =
            query.lat !== undefined &&
            query.lng !== undefined &&
            dto.coordinates
              ? calculateHaversineDistanceKm(
                  query.lat,
                  query.lng,
                  dto.coordinates.lat,
                  dto.coordinates.lng
                )
              : null;
          return { dto, distanceKm, createdAt: gc.createdAt };
        })
        .filter(({ dto, distanceKm }) => {
          if (isOpenNowFilter && !dto.activityStatus.isOpenNow) return false;
          if (isClosedFilter && dto.activityStatus.isOpenNow) return false;
          if (query.minPrice !== undefined && dto.pricing.finalPrice < query.minPrice) return false;
          if (query.maxPrice !== undefined && dto.pricing.finalPrice > query.maxPrice) return false;
          if (query.minRating !== undefined && dto.rating.average < query.minRating) return false;
          if (query.lat !== undefined && query.lng !== undefined) {
            if (distanceKm === null) return false;
            if (query.radiusKm !== undefined && distanceKm > query.radiusKm) return false;
          }
          return true;
        });

      if (query.sort) {
        evaluated.sort((a, b) => {
          switch (query.sort) {
            case 'bayesian':
              return (b.dto.ranking?.bayesianScore ?? 0) - (a.dto.ranking?.bayesianScore ?? 0);
            case 'rating':
              return b.dto.rating.average - a.dto.rating.average;
            case 'reviews':
              return b.dto.rating.validReviewsCount - a.dto.rating.validReviewsCount;
            case 'price_asc':
              return a.dto.pricing.finalPrice - b.dto.pricing.finalPrice;
            case 'price_desc':
              return b.dto.pricing.finalPrice - a.dto.pricing.finalPrice;
            case 'distance':
              return (
                (a.distanceKm ?? Number.POSITIVE_INFINITY) -
                (b.distanceKm ?? Number.POSITIVE_INFINITY)
              );
            case 'newest':
            default:
              return b.createdAt.getTime() - a.createdAt.getTime();
          }
        });
      }

      const paged = evaluated.slice(skip, skip + take).map((e) => e.dto);
      return formatPaginatedResult(paged, evaluated.length, query.page, query.limit);
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

    const hasGameFilter = Boolean(query.game || query.gameId || query.gameSlug);
    const resolvedGames = hasGameFilter
      ? await resolveMatchingGames(query.game, {
          gameIds: query.gameId ? [query.gameId] : undefined,
          gameSlug: query.gameSlug,
          minScore: 55,
        })
      : [];

    if (hasGameFilter && resolvedGames.length === 0) {
      return {
        ranked: [],
        newlyRegistered: [],
        methodology: {
          algorithm: 'bayesian_average',
          formula: '(v / (v + m)) * R + (m / (v + m)) * C',
          m,
          minReviews,
          globalAverageC: 0,
          scopeTotalValidReviews: 0,
          scope: {
            city: query.city ?? null,
            neighborhood: resolvedNeighborhood,
            deviceType: query.deviceType ? toPublicStationType(query.deviceType) : null,
            amenities: query.amenities ?? [],
          },
          sort: query.sort,
          rankedCount: 0,
          newlyRegisteredCount: 0,
          calculatedAt: now.toISOString(),
        },
      };
    }

    const where = buildFilterConditions({
      city: query.city,
      province: query.province,
      neighborhood: query.neighborhood,
      district: query.district,
      deviceType: query.deviceType,
      amenities: query.amenities,
      resolvedGameIds: resolvedGames.map((g) => g.game.id),
    });

    const rawCenters = (await prisma.gamingCenter.findMany({
      where,
      include: buildCenterInclude(now, hasGameFilter),
    })) as unknown as RawCenterRecord[];

    const matchedCenters = hasGameFilter
      ? filterCentersByGameSupport(rawCenters, resolvedGames, {
          deviceType: query.deviceType,
          playMode: query.playMode,
          now,
        })
      : rawCenters;

    const scopedIds = matchedCenters.map((c) => c.id);
    const [scopedRatingsMap, globalRatingsMap] = await Promise.all([
      aggregateValidRatings(scopedIds),
      aggregateValidRatings(),
    ]);

    const scopedC = computeGlobalAverageC(Array.from(scopedRatingsMap.values()));
    const globalC =
      scopedC.totalValidReviews > 0
        ? scopedC
        : computeGlobalAverageC(Array.from(globalRatingsMap.values()));

    const candidates = matchedCenters.map((gc) => {
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
