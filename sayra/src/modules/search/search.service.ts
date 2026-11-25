import {
  CampaignStatus,
  GamePlayMode,
  GameStationType,
  GamingCenterVerificationStatus,
  Prisma,
  RatingStatus,
  ReservationStatus,
} from '@prisma/client';
import { addDays, addHours } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { formatPaginatedResult, getPaginationParams } from '../../common/utils/pagination';
import { toPublicStationType } from '../../common/utils/station-type';
import {
  buildPersianArabicSearchVariants,
  calculateHaversineDistanceKm,
  getGeoBoundingBox,
  isValidCoordinatePair,
  normalizeSearchText,
  parseSearchDeviceAlias,
  scoreTextMatch,
  TextMatchType,
  tokenizeSearchQuery,
} from '../../common/utils/searchText';
import {
  evaluateCenterOpenStatus,
  isIntervalWithinOperatingHours,
} from '../../common/utils/operatingHours';
import { calculateStationPricing } from '../../common/utils/money';
import {
  calculateGamingCenterPricing,
  extractCoverImages,
} from '../gamingCenter/gamingCenter.repository';
import {
  CenterRatingAggregate,
  computeBayesianScore,
  computeEffectiveCenterRating,
  computeGlobalAverageC,
} from '../public-gamecenters/bayesian.ranking';
import {
  PublicAmenityKey,
  PublicGameCenterDeviceCountsDto,
  PublicGameCenterDeviceSummaryDto,
} from '../public-gamecenters/public-gamecenters.types';
import {
  getActiveGameIndex,
  resolveMatchingGames,
  computeActiveCenterCountsByGame,
} from './gameIndex.service';
import { computeSearchRelevanceScore, sortSearchResults } from './search.ranking';
import {
  IndexedCatalogGame,
  MatchedCenterGameDto,
  MatchedGameStationDto,
  ResolvedGameMatch,
  SearchFacetsDto,
  SearchGameCenterItemDto,
  SearchGameCentersResponseDto,
  SearchSuggestResponseDto,
  ZeroResultSuggestionDto,
} from './search.types';
import { SearchGameCentersQuery, SearchSuggestQuery } from './search.validators';

const FRONTEND_BASE_URL = (
  process.env.SITE_PUBLIC_URL ||
  env.FRONTEND_URL ||
  'https://www.sayra-booking.ir'
).replace(/\/+$/, '');

interface RawSearchStation {
  id: string;
  name: string;
  stationType: GameStationType;
  hourlyPrice: number;
  isVip: boolean;
  isActive: boolean;
  stationGames?: Array<{
    gameCatalogId: string;
    playMode: GamePlayMode;
    isActive: boolean;
  }>;
}

interface RawSearchCenter {
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
  stations: RawSearchStation[];
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
    gameCatalogId: string;
    playMode: GamePlayMode;
    platforms?: GameStationType[];
    gameCatalog?: { id: string; title: string; supportedPlatforms?: GameStationType[]; supportsOnline?: boolean } | null;
  }>;
  stationExtraControllers?: Array<{ id: string }>;
}

function buildCenterSearchInclude(now: Date): Prisma.GamingCenterInclude {
  const hasStationGames = typeof prisma.gameStationGame?.findMany === 'function';
  const hasCenterGames = typeof prisma.gamingCenterGame?.findMany === 'function';
  const hasSchedules = typeof prisma.gamingCenterSchedule?.findMany === 'function';

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
  };
}

async function aggregateValidRatings(): Promise<Map<string, CenterRatingAggregate>> {
  const result = new Map<string, CenterRatingAggregate>();
  if (typeof prisma.rating?.findMany !== 'function') {
    return result;
  }

  const rows = await prisma.rating.findMany({
    where: {
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

  for (const row of rows || []) {
    if (typeof row.rating !== 'number' || !Number.isFinite(row.rating)) continue;
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

function buildContainsOrVariants(
  field: string,
  value: string
): Prisma.AddressWhereInput[] | Prisma.GamingCenterWhereInput[] {
  const variants = buildPersianArabicSearchVariants(value);
  return variants.map((v) => ({ [field]: { contains: v, mode: 'insensitive' as const } }));
}

interface QueryIntentResolution {
  explicitGames: ResolvedGameMatch[];
  hasExplicitGameFilter: boolean;
  inferredGames: ResolvedGameMatch[];
  inferredDeviceTypes: GameStationType[];
  unmatchedFreeText: string | undefined;
}

async function resolveQueryIntents(query: SearchGameCentersQuery): Promise<QueryIntentResolution> {
  const hasExplicitGameFilter = Boolean(
    query.game || query.gameId || query.gameSlug || (query.gameIds && query.gameIds.length > 0)
  );

  let explicitGames: ResolvedGameMatch[] = [];
  if (hasExplicitGameFilter) {
    const idList = [
      ...(query.gameId ? [query.gameId] : []),
      ...(query.gameIds || []),
    ];
    explicitGames = await resolveMatchingGames(query.game, {
      gameIds: idList.length > 0 ? idList : undefined,
      gameSlug: query.gameSlug,
      minScore: 55,
    });
  }

  let inferredGames: ResolvedGameMatch[] = [];
  const inferredDevices: GameStationType[] = [];

  if (query.queryText) {
    const fullMatches = await resolveMatchingGames(query.queryText, { minScore: 60 });
    if (fullMatches.length > 0) {
      inferredGames = fullMatches;
    } else {
      // Try multi-token sub-phrases so queries like "FC 26 تهران" or "فیفا ۲۶ ps5" resolve the game + device
      const tokens = tokenizeSearchQuery(query.queryText);
      const nonDeviceTokens: string[] = [];

      for (const tok of tokens) {
        const dev = parseSearchDeviceAlias(tok);
        if (dev) {
          inferredDevices.push(dev);
        } else {
          nonDeviceTokens.push(tok);
        }
      }

      if (nonDeviceTokens.length >= 2) {
        const candidatePhrases = new Set<string>();
        for (let len = Math.min(4, nonDeviceTokens.length); len >= 1; len--) {
          for (let start = 0; start <= nonDeviceTokens.length - len; start++) {
            const phrase = nonDeviceTokens.slice(start, start + len).join(' ');
            if (phrase.length >= 3) candidatePhrases.add(phrase);
          }
        }
        for (const phrase of candidatePhrases) {
          const phraseMatches = await resolveMatchingGames(phrase, { minScore: 72 });
          if (phraseMatches.length > 0) {
            inferredGames.push(...phraseMatches);
            break;
          }
        }
      }
    }
  }

  // Deduplicate inferred games
  if (inferredGames.length > 1) {
    const seen = new Set<string>();
    inferredGames = inferredGames.filter((m) => {
      if (seen.has(m.game.id)) return false;
      seen.add(m.game.id);
      return true;
    });
  }

  return {
    explicitGames,
    hasExplicitGameFilter,
    inferredGames,
    inferredDeviceTypes: Array.from(new Set(inferredDevices)),
    unmatchedFreeText: query.queryText,
  };
}

/**
 * Resolves real Game <-> Center <-> Device <-> Station linkage for a single GamingCenter.
 * Never infers game support from center name or description.
 */
export function resolveCenterGameStations(
  center: RawSearchCenter,
  gameMatch: ResolvedGameMatch,
  options: {
    deviceTypes?: GameStationType[];
    playMode?: GamePlayMode;
    allowOnlineBooking: boolean;
    isTemporarilyClosed: boolean;
    unavailableStationIds?: Set<string> | null;
    now: Date;
  }
): MatchedCenterGameDto | null {
  const { game } = gameMatch;
  const centerGames = center.centerGames || [];
  const stations = (center.stations || []).filter((s) => s.isActive !== false);

  const cgLink = centerGames.find((cg) => cg.gameCatalogId === game.id);
  const explicitStationLinks = new Map<string, { playMode: GamePlayMode; isActive: boolean }>();
  for (const s of stations) {
    for (const sg of s.stationGames || []) {
      if (sg.gameCatalogId === game.id) {
        explicitStationLinks.set(s.id, { playMode: sg.playMode, isActive: sg.isActive });
      }
    }
  }

  const hasExplicitStationLinks = Array.from(explicitStationLinks.values()).some((v) => v.isActive);

  // Legacy bridge: exact title/titleFa/titleEn match in GamingCenter.games when GamingCenterGame wasn't backfilled yet
  const normalizedKnownTitles = new Set(
    [game.title, game.titleEn, game.titleFa]
      .filter((v): v is string => Boolean(v))
      .map((t) => normalizeSearchText(t))
  );
  const hasLegacyCenterListMatch =
    !cgLink &&
    !hasExplicitStationLinks &&
    Array.isArray(center.games) &&
    center.games.some((raw) => normalizedKnownTitles.has(normalizeSearchText(raw)));

  if (!cgLink && !hasExplicitStationLinks && !hasLegacyCenterListMatch) {
    return null;
  }

  // Determine allowed platforms for this game at this center
  const centerPlatforms =
    cgLink && Array.isArray(cgLink.platforms) && cgLink.platforms.length > 0
      ? cgLink.platforms
      : game.supportedPlatforms;

  const baseAllowedPlatforms =
    game.supportedPlatforms.length > 0 && cgLink?.platforms?.length
      ? centerPlatforms.filter((p) => game.supportedPlatforms.includes(p))
      : centerPlatforms;

  const effectiveAllowedPlatforms =
    options.deviceTypes && options.deviceTypes.length > 0
      ? baseAllowedPlatforms.length > 0
        ? baseAllowedPlatforms.filter((p) => options.deviceTypes!.includes(p))
        : options.deviceTypes
      : baseAllowedPlatforms;

  if (options.deviceTypes && options.deviceTypes.length > 0 && effectiveAllowedPlatforms.length === 0) {
    return null;
  }

  const centerEffectivePlayMode =
    game.supportsOnline && cgLink?.playMode === GamePlayMode.ONLINE
      ? GamePlayMode.ONLINE
      : GamePlayMode.OFFLINE;

  // Determine which active stations support this game
  let candidateStations: Array<{ station: RawSearchStation; playMode: GamePlayMode }> = [];

  if (hasExplicitStationLinks) {
    for (const s of stations) {
      const link = explicitStationLinks.get(s.id);
      if (!link || !link.isActive) continue;
      if (options.deviceTypes && options.deviceTypes.length > 0 && !options.deviceTypes.includes(s.stationType)) {
        continue;
      }
      const stPlayMode =
        game.supportsOnline && link.playMode === GamePlayMode.ONLINE
          ? GamePlayMode.ONLINE
          : GamePlayMode.OFFLINE;
      candidateStations.push({ station: s, playMode: stPlayMode });
    }
  } else {
    for (const s of stations) {
      const explicitDisabled = explicitStationLinks.get(s.id)?.isActive === false;
      if (explicitDisabled) continue;
      if (
        effectiveAllowedPlatforms.length > 0 &&
        !effectiveAllowedPlatforms.includes(s.stationType)
      ) {
        continue;
      }
      candidateStations.push({ station: s, playMode: centerEffectivePlayMode });
    }
  }

  if (options.playMode) {
    candidateStations = candidateStations.filter((entry) => entry.playMode === options.playMode);
  }

  if (candidateStations.length === 0) {
    return null;
  }

  const mappedStations: MatchedGameStationDto[] = candidateStations.map(({ station }) => {
    const stationDiscounts = (center.discounts || []).filter(
      (d) =>
        d.isActive &&
        new Date(d.startAt) <= options.now &&
        new Date(d.endAt) >= options.now &&
        (!d.targetType ||
          (d.targetType === 'STATION' && d.targetId === station.id) ||
          (d.targetType === 'GAMING_CENTER' && d.targetId === center.id))
    );
    const specificStationDiscount = stationDiscounts.find((d) => d.targetType === 'STATION');
    const chosenDiscount = specificStationDiscount ?? stationDiscounts[0] ?? null;
    const pricing = calculateStationPricing(
      station.hourlyPrice,
      chosenDiscount
        ? {
          isActive: chosenDiscount.isActive,
          valueType: chosenDiscount.valueType as 'PERCENTAGE' | 'FIXED_AMOUNT',
          value: chosenDiscount.value,
          startAt: chosenDiscount.startAt,
          endAt: chosenDiscount.endAt,
        }
        : null,
      1,
      options.now
    );

    const isBookable =
      station.isActive !== false &&
      options.allowOnlineBooking &&
      !options.isTemporarilyClosed;

    const isAvailableInWindow = options.unavailableStationIds
      ? isBookable && !options.unavailableStationIds.has(station.id)
      : null;

    return {
      id: station.id,
      name: station.name,
      stationType: toPublicStationType(station.stationType),
      isVip: Boolean(station.isVip),
      hourlyPrice: station.hourlyPrice,
      finalPrice: pricing.finalPrice,
      isActive: station.isActive !== false,
      isBookable,
      isAvailableInWindow,
    };
  });

  const resolvedPlayMode = candidateStations.some((s) => s.playMode === GamePlayMode.ONLINE)
    ? GamePlayMode.ONLINE
    : GamePlayMode.OFFLINE;

  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    titleFa: game.titleFa,
    titleEn: game.titleEn,
    category: game.category,
    coverImageUrl: game.coverImageUrl,
    supportsOnline: game.supportsOnline,
    playMode: resolvedPlayMode,
    supportedPlatforms: game.supportedPlatforms.map((p) => toPublicStationType(p)),
    availablePlatforms: Array.from(new Set(mappedStations.map((s) => s.stationType))),
    activeStationCount: mappedStations.length,
    bookableStationCount: mappedStations.filter((s) => s.isBookable).length,
    matchScore: gameMatch.score,
    matchedTerm: gameMatch.matchedTerm,
    stations: mappedStations,
  };
}

interface AvailabilityWindow {
  mode: 'INTERVAL' | 'DATE_ONLY';
  startTime: Date;
  endTime: Date;
  durationHours: number;
}

function resolveRequestedAvailabilityWindow(
  query: SearchGameCentersQuery,
  now: Date
): AvailabilityWindow | null {
  if (query.availableNow) {
    return {
      mode: 'INTERVAL',
      startTime: now,
      endTime: addHours(now, query.durationHours),
      durationHours: query.durationHours,
    };
  }
  if (query.availableAt) {
    const start = new Date(query.availableAt);
    return {
      mode: 'INTERVAL',
      startTime: start,
      endTime: addHours(start, query.durationHours),
      durationHours: query.durationHours,
    };
  }
  if (query.date && query.startTime) {
    const start = fromZonedTime(`${query.date} ${query.startTime}:00`, 'Asia/Tehran');
    return {
      mode: 'INTERVAL',
      startTime: start,
      endTime: addHours(start, query.durationHours),
      durationHours: query.durationHours,
    };
  }
  if (query.date) {
    const start = fromZonedTime(`${query.date} 00:00:00`, 'Asia/Tehran');
    return {
      mode: 'DATE_ONLY',
      startTime: start,
      endTime: addDays(start, 1),
      durationHours: query.durationHours,
    };
  }
  return null;
}

/**
 * Single batched availability check across all candidate stations (no N+1 per center/station).
 */
async function batchFetchUnavailableStationIds(
  stationIds: string[],
  window: AvailabilityWindow | null,
  now: Date
): Promise<Set<string> | null> {
  if (!window || stationIds.length === 0) {
    return window ? new Set<string>() : null;
  }

  const unavailable = new Set<string>();
  const { startTime, endTime } = window;

  const [reservations, holds, maintenances] = await Promise.all([
    typeof prisma.reservation?.findMany === 'function'
      ? prisma.reservation.findMany({
        where: {
          stationId: { in: stationIds },
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.IN_PROGRESS, ReservationStatus.PENDING] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: { stationId: true, startTime: true, endTime: true },
      })
      : Promise.resolve([]),
    typeof prisma.bookingHold?.findMany === 'function'
      ? prisma.bookingHold.findMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { gt: now },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
          items: { some: { stationId: { in: stationIds } } },
        },
        select: {
          startTime: true,
          endTime: true,
          items: { select: { stationId: true } },
        },
      })
      : Promise.resolve([]),
    typeof prisma.stationMaintenance?.findMany === 'function'
      ? prisma.stationMaintenance.findMany({
        where: {
          stationId: { in: stationIds },
          startTime: { lt: endTime },
          OR: [{ endTime: null }, { endTime: { gt: startTime } }],
        },
        select: { stationId: true, startTime: true, endTime: true },
      })
      : Promise.resolve([]),
  ]);

  if (window.mode === 'INTERVAL') {
    for (const r of reservations || []) {
      if (r.stationId) unavailable.add(r.stationId);
    }
    for (const h of holds || []) {
      for (const item of h.items || []) {
        if (item.stationId) unavailable.add(item.stationId);
      }
    }
    for (const m of maintenances || []) {
      if (m.stationId) unavailable.add(m.stationId);
    }
  } else {
    // For date-only filter, block a station only if maintenance spans the full 24h window
    for (const m of maintenances || []) {
      const mStart = new Date(m.startTime);
      const mEnd = m.endTime ? new Date(m.endTime) : new Date(8640000000000000);
      if (mStart <= startTime && mEnd >= endTime) {
        unavailable.add(m.stationId);
      }
    }
  }

  return unavailable;
}

function summarizeCenterDevices(gc: RawSearchCenter): {
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
    if (station.isVip) entry.hasVip = true;
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
  const consoleTotal =
    counts['PLAYSTATION 4'] + counts['PLAYSTATION 5'] + counts.XBOX + counts.SWITCH + counts.VR;
  const consoleCount = hasStations ? consoleTotal : gc.consoleCount;

  return { devices, deviceCounts: counts, pcCount, consoleCount, lowestStationPrice };
}

function deriveCenterAmenities(gc: RawSearchCenter): PublicAmenityKey[] {
  const amenities: PublicAmenityKey[] = [];
  if (gc.hasFoodService) amenities.push('food_service');
  if (
    (gc.vipHourlyRate !== null && gc.vipHourlyRate !== undefined) ||
    (gc.stations || []).some((s) => s.isActive !== false && s.isVip)
  ) {
    amenities.push('vip');
  }
  if (gc.settings?.allowOnlineBooking === true) amenities.push('online_booking');
  if (Array.isArray(gc.centerGames) && gc.centerGames.length > 0) amenities.push('online_games');
  if (Array.isArray(gc.stationExtraControllers) && gc.stationExtraControllers.length > 0) {
    amenities.push('extra_controllers');
  }
  return amenities;
}

function scoreCenterTextAndLocation(
  center: RawSearchCenter,
  query: SearchGameCentersQuery,
  hasResolvedGameFromText: boolean
): {
  textScore: number;
  matchType: TextMatchType;
  locationMatchScore: number;
} {
  const primaryAddress =
    (center.addresses || []).find((a) => a.isPrimary) ?? (center.addresses || [])[0] ?? null;

  let textScore = 0;
  let matchType: TextMatchType = 'none';

  if (query.queryText) {
    const identityTargets = [
      { value: center.name, weight: 1.0 },
      { value: center.slug.replace(/-/g, ' '), weight: 0.95 },
      ...(primaryAddress?.city ? [{ value: primaryAddress.city, weight: 0.85 }] : []),
      ...(primaryAddress?.district ? [{ value: primaryAddress.district, weight: 0.85 }] : []),
      ...(primaryAddress?.addressLine ? [{ value: primaryAddress.addressLine, weight: 0.75 }] : []),
      // Only consider description when query didn't unambiguously resolve to a catalog game
      ...(!hasResolvedGameFromText && center.description
        ? [{ value: center.description, weight: 0.65 }]
        : []),
    ];

    for (const target of identityTargets) {
      const m = scoreTextMatch(query.queryText, target.value);
      if (m.matched) {
        const weighted = Math.round(m.score * target.weight);
        if (weighted > textScore) {
          textScore = weighted;
          matchType = m.matchType;
        }
      }
    }
  }

  let locationMatchScore = 0;
  let locChecks = 0;
  let locSum = 0;
  let allLocationFiltersMatched = true;

  if (query.city) {
    locChecks += 1;
    const bestCity = (center.addresses || []).reduce((acc, a) => {
      const m = scoreTextMatch(query.city!, a.city);
      return Math.max(acc, m.score / 100);
    }, 0);
    if (bestCity === 0) allLocationFiltersMatched = false;
    locSum += bestCity;
  }

  if (query.neighborhood) {
    locChecks += 1;
    const bestNeighborhood = (center.addresses || []).reduce((acc, a) => {
      if (!a.district) return acc;
      const m = scoreTextMatch(query.neighborhood!, a.district);
      return Math.max(acc, m.score / 100);
    }, 0);
    if (bestNeighborhood === 0) allLocationFiltersMatched = false;
    locSum += bestNeighborhood;
  }

  if (query.province) {
    locChecks += 1;
    const bestProvince = (center.addresses || []).reduce((acc, a) => {
      if (!a.province) return acc;
      const m = scoreTextMatch(query.province!, a.province);
      return Math.max(acc, m.score / 100);
    }, 0);
    if (bestProvince === 0) allLocationFiltersMatched = false;
    locSum += bestProvince;
  }

  if (locChecks > 0) {
    locationMatchScore = allLocationFiltersMatched ? locSum / locChecks : 0;
  }

  return { textScore, matchType, locationMatchScore };
}

function buildSearchFacets(
  items: SearchGameCenterItemDto[],
  indexedGamesById: Map<string, IndexedCatalogGame>
): SearchFacetsDto {
  const cityCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();
  const amenityCounts = new Map<string, number>();
  const gameCounts = new Map<string, { id: string; slug: string | null; title: string; titleFa: string | null; count: number }>();

  let minPrice: number | null = null;
  let maxPrice: number | null = null;
  let openNowCount = 0;

  for (const item of items) {
    if (item.city) {
      cityCounts.set(item.city, (cityCounts.get(item.city) ?? 0) + 1);
    }
    for (const dev of item.devices) {
      if (dev.count > 0) {
        deviceCounts.set(dev.type, (deviceCounts.get(dev.type) ?? 0) + 1);
      }
    }
    for (const am of item.amenities) {
      amenityCounts.set(am, (amenityCounts.get(am) ?? 0) + 1);
    }
    if (item.activityStatus.isOpenNow) {
      openNowCount += 1;
    }
    if (item.pricing.finalPrice > 0) {
      minPrice = minPrice === null ? item.pricing.finalPrice : Math.min(minPrice, item.pricing.finalPrice);
      maxPrice = maxPrice === null ? item.pricing.finalPrice : Math.max(maxPrice, item.pricing.finalPrice);
    }
    for (const mg of item.matchedGames) {
      const cat = indexedGamesById.get(mg.id);
      const entry = gameCounts.get(mg.id) ?? {
        id: mg.id,
        slug: mg.slug,
        title: mg.title,
        titleFa: cat?.titleFa ?? mg.titleFa,
        count: 0,
      };
      entry.count += 1;
      gameCounts.set(mg.id, entry);
    }
  }

  return {
    cities: Array.from(cityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, label: key, count })),
    deviceTypes: Array.from(deviceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, label: key, count })),
    amenities: Array.from(amenityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, label: key, count })),
    games: Array.from(gameCounts.values()).sort((a, b) => b.count - a.count),
    priceRange: {
      min: minPrice,
      max: maxPrice,
      currency: 'IRT',
    },
    openNowCount,
  };
}

function buildDbCandidateWhere(
  query: SearchGameCentersQuery,
  resolvedGameIds: string[],
  effectiveDeviceTypes?: GameStationType[]
): Prisma.GamingCenterWhereInput {
  const andConditions: Prisma.GamingCenterWhereInput[] = [];

  if (query.city || query.province || query.neighborhood) {
    const addrAnd: Prisma.AddressWhereInput[] = [];
    if (query.city) {
      addrAnd.push({ OR: buildContainsOrVariants('city', query.city) as Prisma.AddressWhereInput[] });
    }
    if (query.province) {
      addrAnd.push({ OR: buildContainsOrVariants('province', query.province) as Prisma.AddressWhereInput[] });
    }
    if (query.neighborhood) {
      addrAnd.push({ OR: buildContainsOrVariants('district', query.neighborhood) as Prisma.AddressWhereInput[] });
    }
    andConditions.push({ addresses: { some: { AND: addrAnd } } });
  }

  if (query.lat !== undefined && query.lng !== undefined) {
    const radius = query.radiusKm ?? 50;
    const box = getGeoBoundingBox(query.lat, query.lng, radius);
    andConditions.push({
      addresses: {
        some: {
          lat: { gte: box.minLat, lte: box.maxLat },
          lng: { gte: box.minLng, lte: box.maxLng },
        },
      },
    });
  }

  if (effectiveDeviceTypes && effectiveDeviceTypes.length > 0) {
    andConditions.push({
      stations: {
        some: {
          isActive: true,
          stationType: { in: effectiveDeviceTypes },
        },
      },
    });
  }

  if (query.hasFoodService === true) {
    andConditions.push({ hasFoodService: true });
  } else if (query.hasFoodService === false) {
    andConditions.push({ hasFoodService: false });
  }

  if (query.allowOnlineBooking === true) {
    andConditions.push({ settings: { allowOnlineBooking: true } });
  } else if (query.allowOnlineBooking === false) {
    andConditions.push({ settings: { allowOnlineBooking: false } });
  }

  if (query.isVip === true) {
    andConditions.push({
      OR: [
        { vipHourlyRate: { not: null } },
        { stations: { some: { isActive: true, isVip: true } } },
      ],
    });
  }

  if (query.amenities && query.amenities.length > 0) {
    for (const amenity of query.amenities) {
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
        andConditions.push({ centerGames: { some: { playMode: GamePlayMode.ONLINE } } });
        break;
      case 'extra_controllers':
        andConditions.push({ stationExtraControllers: { some: { isActive: true } } });
        break;
      }
    }
  }

  if (resolvedGameIds.length > 0) {
    const hasCenterGames = typeof prisma.gamingCenterGame?.findMany === 'function';
    const hasStationGames = typeof prisma.gameStationGame?.findMany === 'function';
    const gameOr: Prisma.GamingCenterWhereInput[] = [];
    if (hasCenterGames) {
      gameOr.push({ centerGames: { some: { gameCatalogId: { in: resolvedGameIds } } } });
    }
    if (hasStationGames) {
      gameOr.push({
        stations: {
          some: {
            isActive: true,
            stationGames: { some: { gameCatalogId: { in: resolvedGameIds }, isActive: true } },
          },
        },
      });
    }
    if (gameOr.length > 0 && !query.queryText) {
      andConditions.push({ OR: gameOr });
    }
  }

  return {
    isActive: true,
    verificationStatus: GamingCenterVerificationStatus.APPROVED,
    ...(andConditions.length > 0 ? { AND: andConditions } : {}),
  };
}

export const SearchService = {
  async searchGameCenters(query: SearchGameCentersQuery): Promise<SearchGameCentersResponseDto> {
    const now = new Date();
    const m = env.RANKING_BAYESIAN_M;
    const minReviews = env.RANKING_MIN_REVIEWS_DEFAULT;

    const intents = await resolveQueryIntents(query);
    const activeGamesIndex = await getActiveGameIndex();
    const gamesById = new Map(activeGamesIndex.map((g) => [g.id, g]));

    const targetGames: ResolvedGameMatch[] = intents.hasExplicitGameFilter
      ? intents.explicitGames
      : intents.inferredGames;

    const hasResolvedGameFromText = !intents.hasExplicitGameFilter && intents.inferredGames.length > 0;
    const effectiveDeviceTypes =
      query.deviceTypes && query.deviceTypes.length > 0
        ? query.deviceTypes
        : intents.inferredDeviceTypes.length > 0
          ? intents.inferredDeviceTypes
          : undefined;

    const appliedFilters: Record<string, unknown> = {
      ...(query.queryText ? { q: query.queryText } : {}),
      ...(query.game ? { game: query.game } : {}),
      ...(query.gameId ? { gameId: query.gameId } : {}),
      ...(query.gameSlug ? { gameSlug: query.gameSlug } : {}),
      ...(query.city ? { city: query.city } : {}),
      ...(query.province ? { province: query.province } : {}),
      ...(query.neighborhood ? { neighborhood: query.neighborhood } : {}),
      ...(effectiveDeviceTypes
        ? { deviceTypes: effectiveDeviceTypes.map((d) => toPublicStationType(d)) }
        : {}),
      ...(query.amenities ? { amenities: query.amenities } : {}),
      ...(query.minPrice !== undefined ? { minPrice: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { maxPrice: query.maxPrice } : {}),
      ...(query.minRating !== undefined ? { minRating: query.minRating } : {}),
      ...(query.isOpen !== undefined ? { isOpen: query.isOpen } : {}),
      ...(query.availableNow ? { availableNow: true } : {}),
      ...(query.date ? { date: query.date } : {}),
      ...(query.startTime ? { startTime: query.startTime } : {}),
      sort: query.sort,
    };

    const resolvedGamesSummary = targetGames.map((g) => ({
      id: g.game.id,
      slug: g.game.slug,
      title: g.game.title,
      titleFa: g.game.titleFa,
      titleEn: g.game.titleEn,
      category: g.game.category,
      matchType: g.matchType,
      score: g.score,
    }));

    // If an explicit game filter was provided and zero catalog games matched, return empty immediately with suggestions
    if (intents.hasExplicitGameFilter && targetGames.length === 0) {
      const fuzzyAlternatives = query.game
        ? await resolveMatchingGames(query.game, { minScore: 40 })
        : [];
      const suggestions: ZeroResultSuggestionDto[] = fuzzyAlternatives.slice(0, 3).map((alt) => ({
        type: 'DID_YOU_MEAN_GAME',
        label: `آیا منظورتان بازی «${alt.game.titleFa || alt.game.title}» است؟`,
        filterKey: 'game',
        suggestedValue: alt.game.slug || alt.game.title,
      }));

      return {
        ...formatPaginatedResult([], 0, query.page, query.limit),
        appliedFilters,
        resolvedGames: [],
        ...(query.includeFacets
          ? {
            facets: {
              cities: [],
              deviceTypes: [],
              amenities: [],
              games: [],
              priceRange: { min: null, max: null, currency: 'IRT' },
              openNowCount: 0,
            },
          }
          : {}),
        suggestions,
      };
    }

    const where = buildDbCandidateWhere(
      query,
      targetGames.map((g) => g.game.id),
      effectiveDeviceTypes
    );

    const [rawCenters, ratingsMap] = await Promise.all([
      prisma.gamingCenter.findMany({
        where,
        include: buildCenterSearchInclude(now),
      }) as unknown as Promise<RawSearchCenter[]>,
      aggregateValidRatings(),
    ]);

    const { globalAverageC } = computeGlobalAverageC(Array.from(ratingsMap.values()));

    const availabilityWindow = resolveRequestedAvailabilityWindow(query, now);
    const allCandidateStationIds = availabilityWindow
      ? rawCenters.flatMap((c) =>
        (c.stations || []).filter((s) => s.isActive !== false).map((s) => s.id)
      )
      : [];

    const unavailableStationIds = await batchFetchUnavailableStationIds(
      allCandidateStationIds,
      availabilityWindow,
      now
    );

    const evaluateCandidates = (
      activeQuery: SearchGameCentersQuery
    ): SearchGameCenterItemDto[] => {
      const matchedItems: SearchGameCenterItemDto[] = [];

      for (const gc of rawCenters || []) {
        // Defense-in-depth public eligibility check
        if (gc.isActive !== true || gc.verificationStatus !== GamingCenterVerificationStatus.APPROVED) {
          continue;
        }

        const primaryAddress =
          (gc.addresses || []).find((a) => a.isPrimary) ?? (gc.addresses || [])[0] ?? null;

        const hasValidCoords =
          primaryAddress && isValidCoordinatePair(primaryAddress.lat, primaryAddress.lng);
        const coordinates = hasValidCoords
          ? { lat: Number(primaryAddress!.lat), lng: Number(primaryAddress!.lng) }
          : null;

        let distanceKm: number | null = null;
        if (activeQuery.lat !== undefined && activeQuery.lng !== undefined) {
          if (!coordinates) {
            // Invalid or missing coordinates must not appear in geo-distance search
            continue;
          }
          distanceKm = calculateHaversineDistanceKm(
            activeQuery.lat,
            activeQuery.lng,
            coordinates.lat,
            coordinates.lng
          );
          if (activeQuery.radiusKm !== undefined && distanceKm > activeQuery.radiusKm) {
            continue;
          }
        }

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

        if (activeQuery.isOpen !== undefined && openStatus.isOpenNow !== activeQuery.isOpen) {
          continue;
        }

        const allowOnlineBooking = gc.settings?.allowOnlineBooking === true;
        if (
          activeQuery.allowOnlineBooking !== undefined &&
          allowOnlineBooking !== activeQuery.allowOnlineBooking
        ) {
          continue;
        }

        const amenities = deriveCenterAmenities(gc);
        if (activeQuery.hasFoodService !== undefined && gc.hasFoodService !== activeQuery.hasFoodService) {
          continue;
        }
        if (activeQuery.isVip !== undefined) {
          const centerHasVip = amenities.includes('vip');
          if (centerHasVip !== activeQuery.isVip) continue;
        }
        if (activeQuery.amenities && activeQuery.amenities.length > 0) {
          const hasAll = activeQuery.amenities.every((a) => amenities.includes(a));
          if (!hasAll) continue;
        }

        const { devices, deviceCounts, pcCount, consoleCount, lowestStationPrice } =
          summarizeCenterDevices(gc);
        const startingRate = lowestStationPrice !== null ? lowestStationPrice : gc.hourlyRate;
        const pricing = calculateGamingCenterPricing(
          startingRate,
          gc.discounts,
          gc.discountCampaigns,
          now
        );

        if (activeQuery.hasDiscount !== undefined && pricing.hasDiscount !== activeQuery.hasDiscount) {
          continue;
        }
        if (activeQuery.minPrice !== undefined && pricing.finalPrice < activeQuery.minPrice) {
          continue;
        }
        if (activeQuery.maxPrice !== undefined && pricing.finalPrice > activeQuery.maxPrice) {
          continue;
        }

        // Device type & minStationCount filter
        const activeStations = (gc.stations || []).filter((s) => s.isActive !== false);
        const matchingDeviceStations = effectiveDeviceTypes
          ? activeStations.filter((s) => effectiveDeviceTypes.includes(s.stationType))
          : activeStations;

        if (effectiveDeviceTypes && matchingDeviceStations.length === 0) {
          continue;
        }
        if (
          activeQuery.minStationCount !== undefined &&
          matchingDeviceStations.length < activeQuery.minStationCount
        ) {
          continue;
        }

        // Rating filter (using real average of published valid reviews)
        const ratingStats = ratingsMap.get(gc.id) ?? {
          sumRatings: 0,
          validReviewsCount: 0,
          latestReviewAt: null,
        };
        const v = ratingStats.validReviewsCount;
        const { effectiveAverage: exactR } = computeEffectiveCenterRating({
          sumRatings: ratingStats.sumRatings,
          validReviewsCount: v,
          sayraRating: (gc as any).sayraRating,
        });
        const rawAvg = exactR > 0 ? Math.round(exactR * 100) / 100 : 0;
        const bayesianScore = computeBayesianScore(exactR, v, m, globalAverageC);
        const isEligibleForRanking = v > 0 && v >= minReviews;

        if (activeQuery.minRating !== undefined && rawAvg < activeQuery.minRating) {
          continue;
        }

        // Game linkage resolution
        const matchedGames: MatchedCenterGameDto[] = [];
        for (const gm of targetGames) {
          const resolved = resolveCenterGameStations(gc, gm, {
            deviceTypes: effectiveDeviceTypes,
            playMode: activeQuery.playMode,
            allowOnlineBooking,
            isTemporarilyClosed: openStatus.isTemporarilyClosed,
            unavailableStationIds,
            now,
          });
          if (resolved) {
            matchedGames.push(resolved);
          }
        }

        // Strict game gate when explicit game filter is used
        if (intents.hasExplicitGameFilter && matchedGames.length === 0) {
          continue;
        }

        // Text / location match scoring
        const { textScore, matchType, locationMatchScore } = scoreCenterTextAndLocation(
          gc,
          activeQuery,
          hasResolvedGameFromText
        );

        // If user provided city/province/neighborhood, verify fuzzy/normalized match
        if (
          (activeQuery.city || activeQuery.neighborhood || activeQuery.province) &&
          locationMatchScore === 0
        ) {
          continue;
        }

        // If free-text `q` was provided without explicit game filter:
        // must match either a resolved game with active compatible stations OR center identity text
        if (activeQuery.queryText && !intents.hasExplicitGameFilter) {
          const matchedViaGame = matchedGames.length > 0;
          const matchedViaText = textScore >= 50;
          if (!matchedViaGame && !matchedViaText) {
            continue;
          }
          // When query resolved clearly to a game (e.g. "FC 26") and center didn't have the game,
          // do NOT match unrelated centers unless center's own name strongly matched the query
          if (hasResolvedGameFromText && !matchedViaGame && textScore < 72) {
            continue;
          }
        }

        // Availability window check
        let isWithinHoursForWindow = true;
        if (availabilityWindow) {
          isWithinHoursForWindow = isIntervalWithinOperatingHours(
            availabilityWindow.startTime,
            availabilityWindow.endTime,
            {
              openingTime: gc.openingTime,
              closingTime: gc.closingTime,
              closedDays: gc.closedDays,
              timezone: gc.timezone,
              settings: gc.settings,
              schedules: gc.schedules,
              closures: gc.closures,
            }
          );
        }

        const stationsPoolForAvail =
          matchedGames.length > 0
            ? Array.from(
              new Map(
                matchedGames.flatMap((mg) => mg.stations).map((s) => [s.id, s])
              ).values()
            )
            : matchingDeviceStations.map((s) => ({
              id: s.id,
              isBookable: s.isActive !== false && allowOnlineBooking && !openStatus.isTemporarilyClosed,
              isAvailableInWindow: unavailableStationIds
                ? s.isActive !== false &&
                    allowOnlineBooking &&
                    !openStatus.isTemporarilyClosed &&
                    !unavailableStationIds.has(s.id)
                : null,
            }));

        let availableMatchingStations: number | null = null;
        if (availabilityWindow) {
          availableMatchingStations = !isWithinHoursForWindow
            ? 0
            : stationsPoolForAvail.filter((s) => s.isAvailableInWindow === true).length;

          if (availableMatchingStations < activeQuery.minAvailableStations) {
            continue;
          }
        }

        const activeMedia = (gc.media || []).filter((med) => med.isActive !== false);
        const { coverImageUrl } = extractCoverImages(activeMedia);
        const detailUrl = `/gamecenter/${encodeURIComponent(gc.slug)}`;

        const bestGame = matchedGames.reduce<{ score: number; hasOnline: boolean }>(
          (acc, mg) => ({
            score: Math.max(acc.score, mg.matchScore),
            hasOnline: acc.hasOnline || mg.playMode === GamePlayMode.ONLINE,
          }),
          { score: 0, hasOnline: false }
        );

        const searchRelevance = computeSearchRelevanceScore({
          textScore,
          textMatchType: matchType,
          hasGameFilter: targetGames.length > 0,
          matchedGamesCount: matchedGames.length,
          bestGameScore: bestGame.score,
          matchedGameOnlineOk:
            activeQuery.playMode === GamePlayMode.ONLINE ? bestGame.hasOnline : matchedGames.length > 0,
          hasDeviceFilter: Boolean(effectiveDeviceTypes && effectiveDeviceTypes.length > 0),
          deviceCompatibilityScore:
            effectiveDeviceTypes && effectiveDeviceTypes.length > 0
              ? matchingDeviceStations.length > 0
                ? 1
                : 0
              : 0,
          hasLocationFilter: Boolean(
            activeQuery.city || activeQuery.neighborhood || activeQuery.province || activeQuery.lat !== undefined
          ),
          locationMatchScore,
          distanceKm,
          radiusKm: activeQuery.radiusKm,
          bayesianScore,
          validReviewsCount: v,
          globalAverageC,
          isOpenNow: openStatus.isOpenNow,
          allowOnlineBooking,
          hasAvailableSlot:
            availabilityWindow !== null
              ? (availableMatchingStations ?? 0) > 0
              : openStatus.isOpenNow && allowOnlineBooking,
        });

        matchedItems.push({
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
            gallery: activeMedia.map((med) => ({
              url: med.url,
              thumbUrl: med.thumbUrl ?? null,
              altText: med.altText ?? null,
              purpose: med.purpose,
            })),
          },
          devices,
          deviceCounts,
          pcCount,
          consoleCount,
          amenities,
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
            latestReviewAt: ratingStats.latestReviewAt
              ? ratingStats.latestReviewAt.toISOString()
              : null,
          },
          ranking: {
            bayesianScore,
            rawAverageR: rawAvg,
            validReviewsCountV: v,
            globalAverageC,
            m,
            minReviews,
            isEligibleForRanking,
            rank: null,
          },
          detailUrl,
          absoluteDetailUrl: `${FRONTEND_BASE_URL}${detailUrl}`,
          updatedAt: gc.updatedAt.toISOString(),
          distanceKm,
          matchedGames,
          availabilitySummary: {
            checkedWindow: availabilityWindow
              ? {
                startTime: availabilityWindow.startTime.toISOString(),
                endTime: availabilityWindow.endTime.toISOString(),
                durationHours: availabilityWindow.durationHours,
              }
              : null,
            totalActiveStations: activeStations.length,
            matchingActiveStations: matchingDeviceStations.length,
            availableMatchingStations,
            canBookOnline: allowOnlineBooking && !openStatus.isTemporarilyClosed,
          },
          searchRelevance,
        });
      }

      return matchedItems;
    };

    const filtered = evaluateCandidates(query);
    const sorted = sortSearchResults(filtered, query.sort);
    const { skip, take } = getPaginationParams(query.page, query.limit);
    const paged = sorted.slice(skip, skip + take);

    const facets = query.includeFacets ? buildSearchFacets(sorted, gamesById) : undefined;

    let suggestions: ZeroResultSuggestionDto[] | undefined;
    if (sorted.length === 0) {
      suggestions = [];

      // Suggest relaxing individual restrictive filters if doing so yields results
      if (query.isOpen === true) {
        const relaxed = evaluateCandidates({ ...query, isOpen: undefined });
        if (relaxed.length > 0) {
          suggestions.push({
            type: 'RELAX_FILTER',
            label: `حذف فیلتر «هم‌اکنون باز» (${relaxed.length} نتیجه موجود است)`,
            filterKey: 'isOpen',
            estimatedCount: relaxed.length,
          });
        }
      }
      if (query.maxPrice !== undefined || query.minPrice !== undefined) {
        const relaxed = evaluateCandidates({ ...query, minPrice: undefined, maxPrice: undefined });
        if (relaxed.length > 0) {
          suggestions.push({
            type: 'RELAX_FILTER',
            label: `گسترده‌تر کردن بازه قیمت (${relaxed.length} نتیجه موجود است)`,
            filterKey: 'price',
            estimatedCount: relaxed.length,
          });
        }
      }
      if (query.neighborhood) {
        const relaxed = evaluateCandidates({ ...query, neighborhood: undefined });
        if (relaxed.length > 0) {
          suggestions.push({
            type: 'RELAX_FILTER',
            label: `جست‌وجو در کل شهر به جای محله «${query.neighborhood}» (${relaxed.length} نتیجه)`,
            filterKey: 'neighborhood',
            estimatedCount: relaxed.length,
          });
        }
      }
    }

    return {
      ...formatPaginatedResult(paged, sorted.length, query.page, query.limit),
      appliedFilters,
      resolvedGames: resolvedGamesSummary,
      ...(facets ? { facets } : {}),
      ...(suggestions ? { suggestions } : {}),
    };
  },

  async getAutocompleteSuggestions(query: SearchSuggestQuery): Promise<SearchSuggestResponseDto> {
    const q = query.q.trim();
    const limit = query.limit;

    const [gameMatches, activeCenters, ratingsMap] = await Promise.all([
      resolveMatchingGames(q, { minScore: 55 }),
      prisma.gamingCenter.findMany({
        where: {
          isActive: true,
          verificationStatus: GamingCenterVerificationStatus.APPROVED,
          ...(query.city
            ? {
              addresses: {
                some: {
                  OR: buildContainsOrVariants('city', query.city) as Prisma.AddressWhereInput[],
                },
              },
            }
            : {}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          openingTime: true,
          closingTime: true,
          closedDays: true,
          timezone: true,
          addresses: {
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            select: { city: true, district: true, isPrimary: true },
          },
          media: {
            where: { isActive: true, purpose: 'COVER' },
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { url: true },
          },
          settings: {
            select: { workStartTime: true, workEndTime: true, timeZone: true },
          },
          closures: {
            where: { endDate: { gt: new Date() } },
            select: { id: true, title: true, reason: true, startDate: true, endDate: true },
          },
        },
      }),
      aggregateValidRatings(),
    ]);

    const topGameMatches = gameMatches.slice(0, limit);
    const centerCounts = await computeActiveCenterCountsByGame(
      topGameMatches.map((m) => m.game.id)
    );

    const games = topGameMatches.map((m) => ({
      id: m.game.id,
      slug: m.game.slug,
      title: m.game.title,
      titleFa: m.game.titleFa,
      titleEn: m.game.titleEn,
      category: m.game.category,
      coverImageUrl: m.game.coverImageUrl,
      supportedPlatforms: m.game.supportedPlatforms.map((p) => toPublicStationType(p)),
      centerCount: centerCounts.get(m.game.id) ?? 0,
      matchType: m.matchType,
      score: m.score,
    }));

    const now = new Date();
    const matchedCenters: SearchSuggestResponseDto['gameCenters'] = [];
    const cityCounts = new Map<string, number>();
    const neighborhoodCounts = new Map<string, { name: string; city: string; count: number }>();

    for (const c of activeCenters || []) {
      const primaryAddr = (c.addresses || []).find((a) => a.isPrimary) ?? (c.addresses || [])[0];
      const city = primaryAddr?.city?.trim() || null;
      const neighborhood = primaryAddr?.district?.trim() || null;

      if (city) {
        cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
      }
      if (city && neighborhood) {
        const key = `${city}::${neighborhood}`;
        const existing = neighborhoodCounts.get(key) ?? { name: neighborhood, city, count: 0 };
        existing.count += 1;
        neighborhoodCounts.set(key, existing);
      }

      const nameMatch = scoreTextMatch(q, c.name);
      const slugMatch = scoreTextMatch(q, c.slug.replace(/-/g, ' '));
      const bestScore = Math.max(nameMatch.score, slugMatch.score);
      const bestType = nameMatch.score >= slugMatch.score ? nameMatch.matchType : slugMatch.matchType;

      if (bestScore >= 55) {
        const stats = ratingsMap.get(c.id);
        const { effectiveAverage } = computeEffectiveCenterRating({
          sumRatings: stats?.sumRatings ?? 0,
          validReviewsCount: stats?.validReviewsCount ?? 0,
          sayraRating: (c as any).sayraRating,
        });
        const avg = effectiveAverage > 0 ? Math.round(effectiveAverage * 100) / 100 : 0;
        const openStatus = evaluateCenterOpenStatus({
          openingTime: c.openingTime,
          closingTime: c.closingTime,
          closedDays: c.closedDays,
          timezone: c.timezone,
          settings: c.settings,
          closures: c.closures,
          now,
        });

        matchedCenters.push({
          id: c.id,
          name: c.name,
          slug: c.slug,
          city,
          neighborhood,
          coverUrl: c.media?.[0]?.url ?? null,
          ratingAverage: avg,
          isOpenNow: openStatus.isOpenNow,
          detailUrl: `/gamecenter/${encodeURIComponent(c.slug)}`,
          matchType: bestType,
          score: bestScore,
        });
      }
    }

    matchedCenters.sort((a, b) => b.score - a.score || b.ratingAverage - a.ratingAverage);

    const cities = Array.from(cityCounts.entries())
      .map(([name, count]) => ({ name, count, score: scoreTextMatch(q, name).score }))
      .filter((item) => item.score >= 55)
      .sort((a, b) => b.score - a.score || b.count - a.count)
      .slice(0, limit)
      .map(({ name, count }) => ({ name, count }));

    const neighborhoods = Array.from(neighborhoodCounts.values())
      .map((item) => ({ ...item, score: scoreTextMatch(q, item.name).score }))
      .filter((item) => item.score >= 55)
      .sort((a, b) => b.score - a.score || b.count - a.count)
      .slice(0, limit)
      .map(({ name, city, count }) => ({ name, city, count }));

    const deviceCandidates: Array<{ type: string; label: string; aliases: string[] }> = [
      { type: 'PLAYSTATION 5', label: 'PlayStation 5 / پی‌اس ۵', aliases: ['ps5', 'playstation 5', 'پی اس 5', 'پلی استیشن 5'] },
      { type: 'PLAYSTATION 4', label: 'PlayStation 4 / پی‌اس ۴', aliases: ['ps4', 'playstation 4', 'پی اس 4', 'پلی استیشن 4'] },
      { type: 'PC', label: 'PC / سیستم گیمینگ', aliases: ['pc', 'پی سی', 'کامپیوتر'] },
      { type: 'XBOX', label: 'Xbox / ایکس‌باکس', aliases: ['xbox', 'ایکس باکس'] },
      { type: 'SWITCH', label: 'Nintendo Switch / نینتندو سوییچ', aliases: ['switch', 'سوییچ', 'نینتندو'] },
      { type: 'VR', label: 'VR / واقعیت مجازی', aliases: ['vr', 'وی آر', 'واقعیت مجازی'] },
    ];

    const devices = deviceCandidates
      .filter((d) => d.aliases.some((alias) => scoreTextMatch(q, alias).score >= 60))
      .slice(0, limit)
      .map(({ type, label }) => ({ type, label }));

    return {
      query: q,
      games,
      gameCenters: matchedCenters.slice(0, limit),
      locations: {
        cities,
        neighborhoods,
      },
      devices,
    };
  },
};
