import { TextMatchType } from '../../common/utils/searchText';
import { SearchGameCenterItemDto, SearchRelevanceBreakdownDto } from './search.types';

export type SearchSortOption =
  | 'relevance'
  | 'bayesian'
  | 'rating'
  | 'reviews'
  | 'price_asc'
  | 'price_desc'
  | 'distance'
  | 'newest';

export interface RelevanceScoreInput {
  textScore: number;
  textMatchType: TextMatchType;
  hasGameFilter: boolean;
  matchedGamesCount: number;
  bestGameScore: number;
  matchedGameOnlineOk: boolean;
  hasDeviceFilter: boolean;
  deviceCompatibilityScore: number; // 0..1
  hasLocationFilter: boolean;
  locationMatchScore: number; // 0..1
  distanceKm: number | null;
  radiusKm?: number;
  bayesianScore: number;
  validReviewsCount: number;
  globalAverageC: number;
  isOpenNow: boolean;
  allowOnlineBooking: boolean;
  hasAvailableSlot: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Computes transparent 0..100 relevance score combining:
 * - Text match (0..30)
 * - Game & compatible active station support (0..25)
 * - Device compatibility (0..10)
 * - Location / geo proximity (0..10)
 * - Smoothed Bayesian credibility that protects new centers with 0 reviews (0..15)
 * - Operational readiness: open now, online booking, real slot availability (0..10)
 */
export function computeSearchRelevanceScore(input: RelevanceScoreInput): SearchRelevanceBreakdownDto {
  const textScore = input.textScore > 0 ? round2((Math.min(100, input.textScore) / 100) * 30) : 0;

  let gameScore = 0;
  if (input.matchedGamesCount > 0) {
    const base = (Math.min(100, input.bestGameScore) / 100) * 20;
    const onlineBonus = input.matchedGameOnlineOk ? 5 : 0;
    gameScore = round2(Math.min(25, base + onlineBonus));
  } else if (!input.hasGameFilter) {
    gameScore = 0;
  }

  const deviceScore = input.hasDeviceFilter
    ? round2(Math.max(0, Math.min(1, input.deviceCompatibilityScore)) * 10)
    : 0;

  let geoScore = 0;
  if (input.distanceKm !== null) {
    const refRadius = input.radiusKm && input.radiusKm > 0 ? input.radiusKm : 25;
    const proximity = Math.max(0, 1 - input.distanceKm / (refRadius * 1.25));
    geoScore = round2(proximity * 10);
  } else if (input.hasLocationFilter) {
    geoScore = round2(Math.max(0, Math.min(1, input.locationMatchScore)) * 10);
  }

  // Credibility: centers with 0 reviews get a fair neutral prior rather than 0,
  // ensuring newly registered centers are never hidden behind unreviewed zeros.
  const effectivePrior = input.globalAverageC > 0 ? input.globalAverageC : 3.5;
  const effectiveRating = input.validReviewsCount > 0 ? input.bayesianScore : effectivePrior;
  const credibilityScore = round2((Math.min(5, Math.max(0, effectiveRating)) / 5) * 15);

  const operationalScore =
    (input.isOpenNow ? 4 : 0) +
    (input.allowOnlineBooking ? 3 : 0) +
    (input.hasAvailableSlot ? 3 : 0);

  const totalScore = round2(
    textScore + gameScore + deviceScore + geoScore + credibilityScore + operationalScore
  );

  return {
    totalScore,
    textScore,
    gameScore,
    deviceScore,
    geoScore,
    credibilityScore,
    operationalScore,
    matchType: input.textMatchType,
  };
}

export function sortSearchResults(
  items: SearchGameCenterItemDto[],
  sort: SearchSortOption
): SearchGameCenterItemDto[] {
  const copy = [...items];

  copy.sort((a, b) => {
    switch (sort) {
    case 'relevance': {
      const diff = b.searchRelevance.totalScore - a.searchRelevance.totalScore;
      if (diff !== 0) return diff;
      break;
    }
    case 'bayesian': {
      const aScore = a.ranking?.bayesianScore ?? 0;
      const bScore = b.ranking?.bayesianScore ?? 0;
      if (bScore !== aScore) return bScore - aScore;
      break;
    }
    case 'rating': {
      if (b.rating.average !== a.rating.average) return b.rating.average - a.rating.average;
      break;
    }
    case 'reviews': {
      if (b.rating.validReviewsCount !== a.rating.validReviewsCount) {
        return b.rating.validReviewsCount - a.rating.validReviewsCount;
      }
      break;
    }
    case 'price_asc': {
      if (a.pricing.finalPrice !== b.pricing.finalPrice) {
        return a.pricing.finalPrice - b.pricing.finalPrice;
      }
      break;
    }
    case 'price_desc': {
      if (b.pricing.finalPrice !== a.pricing.finalPrice) {
        return b.pricing.finalPrice - a.pricing.finalPrice;
      }
      break;
    }
    case 'distance': {
      const dA = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const dB = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (dA !== dB) return dA - dB;
      break;
    }
    case 'newest': {
      const tDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (tDiff !== 0) return tDiff;
      break;
    }
    }

    // Deterministic tie-breakers across all sort modes
    const bayDiff = (b.ranking?.bayesianScore ?? 0) - (a.ranking?.bayesianScore ?? 0);
    if (bayDiff !== 0) return bayDiff;

    const revDiff = b.rating.validReviewsCount - a.rating.validReviewsCount;
    if (revDiff !== 0) return revDiff;

    if (a.pricing.finalPrice !== b.pricing.finalPrice) {
      return a.pricing.finalPrice - b.pricing.finalPrice;
    }

    return a.id.localeCompare(b.id);
  });

  return copy;
}
