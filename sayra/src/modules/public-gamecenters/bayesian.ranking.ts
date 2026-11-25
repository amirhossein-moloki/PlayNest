import { PublicGameCenterRankingSort } from './public-gamecenters.types';

export const SAYRA_RATING_WEIGHT = 0.4;
export const SAYRA_RATING_CUTOFF_REVIEWS = 50;

export interface CenterRatingAggregate {
  sumRatings: number;
  validReviewsCount: number;
  latestReviewAt: Date | null;
  sayraRating?: number | null;
}

export interface EffectiveCenterRatingResult {
  effectiveAverage: number;
  userAverage: number;
  isSayraActive: boolean;
  sayraWeight: number;
}

/**
 * Computes the effective rating of a gaming center incorporating Sayra's official baseline rating:
 * - When valid user reviews >= 50 (or no valid Sayra rating exists): 100% user average (0 if v == 0).
 * - When v == 0 and a valid Sayra rating (1..5) exists: 100% Sayra rating.
 * - When 0 < v < 50 and a valid Sayra rating exists: 60% user average + 40% Sayra rating.
 */
export function computeEffectiveCenterRating(params: {
  sumRatings: number;
  validReviewsCount: number;
  sayraRating?: number | null;
}): EffectiveCenterRatingResult {
  const v = Math.max(0, params.validReviewsCount);
  const userAverage = v > 0 ? params.sumRatings / v : 0;
  const hasSayraRating =
    typeof params.sayraRating === 'number' &&
    Number.isFinite(params.sayraRating) &&
    params.sayraRating >= 1 &&
    params.sayraRating <= 5;

  if (!hasSayraRating || v >= SAYRA_RATING_CUTOFF_REVIEWS) {
    return {
      effectiveAverage: userAverage,
      userAverage,
      isSayraActive: false,
      sayraWeight: 0,
    };
  }

  const sayra = params.sayraRating as number;
  if (v === 0) {
    return {
      effectiveAverage: sayra,
      userAverage: 0,
      isSayraActive: true,
      sayraWeight: 1,
    };
  }

  return {
    effectiveAverage: (1 - SAYRA_RATING_WEIGHT) * userAverage + SAYRA_RATING_WEIGHT * sayra,
    userAverage,
    isSayraActive: true,
    sayraWeight: SAYRA_RATING_WEIGHT,
  };
}

export interface RankableCenterCandidate<TDto> {
  id: string;
  isActive: boolean;
  verificationStatus: string;
  createdAt: Date;
  finalPrice: number;
  ratingStats: CenterRatingAggregate;
  dto: TDto;
  attachRanking: (
    dto: TDto,
    ranking: {
      bayesianScore: number;
      rawAverageR: number;
      validReviewsCountV: number;
      globalAverageC: number;
      m: number;
      minReviews: number;
      isEligibleForRanking: boolean;
      rank: number | null;
    }
  ) => TDto;
}

export interface BayesianRankingOptions {
  m: number;
  minReviews: number;
  globalAverageC: number;
  sort: PublicGameCenterRankingSort;
  limit: number;
  includeNewlyRegistered: boolean;
  newlyRegisteredLimit: number;
}

export interface BayesianRankingOutput<TDto> {
  ranked: TDto[];
  newlyRegistered: TDto[];
  totalRankedEligible: number;
  totalNewlyRegistered: number;
}

function roundTo4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Computes the weighted Bayesian Average across all eligible centers' valid reviews:
 *   C = sum(all valid review scores) / count(all valid reviews)
 */
export function computeGlobalAverageC(stats: CenterRatingAggregate[]): {
  globalAverageC: number;
  totalValidReviews: number;
} {
  let totalSum = 0;
  let totalCount = 0;

  for (const item of stats) {
    if (item.validReviewsCount > 0) {
      totalSum += item.sumRatings;
      totalCount += item.validReviewsCount;
    }
  }

  if (totalCount === 0) {
    return { globalAverageC: 0, totalValidReviews: 0 };
  }

  return {
    globalAverageC: roundTo4(totalSum / totalCount),
    totalValidReviews: totalCount,
  };
}

/**
 * Computes Bayesian Average score:
 *   Score = (v / (v + m)) * R + (m / (v + m)) * C
 *
 * Returns 0 when v <= 0 so unreviewed centers never receive a synthetic score.
 */
export function computeBayesianScore(
  rawAverageR: number,
  validReviewsCountV: number,
  m: number,
  globalAverageC: number
): number {
  if (validReviewsCountV <= 0 || m <= 0) {
    return 0;
  }

  const v = validReviewsCountV;
  const score = (v / (v + m)) * rawAverageR + (m / (v + m)) * globalAverageC;
  return roundTo4(score);
}

function compareDescNullableTime(a: Date | null, b: Date | null): number {
  const aMs = a ? a.getTime() : -1;
  const bMs = b ? b.getTime() : -1;
  return bMs - aMs;
}

/**
 * Ranks active, approved gaming centers using Bayesian Average and separates centers
 * with insufficient valid reviews into a dedicated `newlyRegistered` list.
 *
 * Deterministic tie-breaking rules:
 *  1. Bayesian score (descending)
 *  2. Valid reviews count `v` (descending)
 *  3. Latest valid review recency (descending)
 *  4. Raw average `R` (descending)
 *  5. Stable ID ordering (ascending)
 */
export function rankPublicGameCenters<TDto>(
  candidates: Array<RankableCenterCandidate<TDto>>,
  options: BayesianRankingOptions
): BayesianRankingOutput<TDto> {
  const { m, minReviews, globalAverageC, sort, limit, includeNewlyRegistered, newlyRegisteredLimit } = options;

  // Enforce strict public eligibility (defense in depth alongside DB query filter)
  const activeApproved = candidates.filter(
    (c) => c.isActive === true && c.verificationStatus === 'APPROVED'
  );

  interface ScoredCandidate {
    candidate: RankableCenterCandidate<TDto>;
    rawAverageR: number;
    validReviewsCountV: number;
    bayesianScore: number;
    isEligibleForRanking: boolean;
  }

  const eligible: ScoredCandidate[] = [];
  const newlyRegisteredPool: ScoredCandidate[] = [];

  for (const candidate of activeApproved) {
    const v = Math.max(0, candidate.ratingStats.validReviewsCount);
    const { effectiveAverage: exactR } = computeEffectiveCenterRating({
      sumRatings: candidate.ratingStats.sumRatings,
      validReviewsCount: v,
      sayraRating: candidate.ratingStats.sayraRating,
    });
    const rawAverageR = exactR > 0 ? roundTo2(exactR) : 0;
    const bayesianScore = computeBayesianScore(exactR, v, m, globalAverageC);
    const isEligible = v > 0 && v >= minReviews;

    const scored: ScoredCandidate = {
      candidate,
      rawAverageR,
      validReviewsCountV: v,
      bayesianScore,
      isEligibleForRanking: isEligible,
    };

    if (isEligible) {
      eligible.push(scored);
    } else {
      newlyRegisteredPool.push(scored);
    }
  }

  eligible.sort((a, b) => {
    if (sort === 'rating') {
      if (b.rawAverageR !== a.rawAverageR) return b.rawAverageR - a.rawAverageR;
    } else if (sort === 'reviews') {
      if (b.validReviewsCountV !== a.validReviewsCountV) return b.validReviewsCountV - a.validReviewsCountV;
    } else if (sort === 'newest') {
      const createdDiff = b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime();
      if (createdDiff !== 0) return createdDiff;
    } else if (sort === 'price_asc') {
      if (a.candidate.finalPrice !== b.candidate.finalPrice) return a.candidate.finalPrice - b.candidate.finalPrice;
    } else if (sort === 'price_desc') {
      if (b.candidate.finalPrice !== a.candidate.finalPrice) return b.candidate.finalPrice - a.candidate.finalPrice;
    }

    if (b.bayesianScore !== a.bayesianScore) return b.bayesianScore - a.bayesianScore;
    if (b.validReviewsCountV !== a.validReviewsCountV) return b.validReviewsCountV - a.validReviewsCountV;

    const recencyDiff = compareDescNullableTime(
      a.candidate.ratingStats.latestReviewAt,
      b.candidate.ratingStats.latestReviewAt
    );
    if (recencyDiff !== 0) return recencyDiff;

    if (b.rawAverageR !== a.rawAverageR) return b.rawAverageR - a.rawAverageR;
    return a.candidate.id.localeCompare(b.candidate.id);
  });

  newlyRegisteredPool.sort((a, b) => {
    const createdDiff = b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime();
    if (createdDiff !== 0) return createdDiff;
    if (b.validReviewsCountV !== a.validReviewsCountV) return b.validReviewsCountV - a.validReviewsCountV;
    return a.candidate.id.localeCompare(b.candidate.id);
  });

  const slicedRanked = eligible.slice(0, limit).map((item, idx) =>
    item.candidate.attachRanking(item.candidate.dto, {
      bayesianScore: item.bayesianScore,
      rawAverageR: item.rawAverageR,
      validReviewsCountV: item.validReviewsCountV,
      globalAverageC,
      m,
      minReviews,
      isEligibleForRanking: true,
      rank: idx + 1,
    })
  );

  const slicedNewlyRegistered = includeNewlyRegistered
    ? newlyRegisteredPool.slice(0, newlyRegisteredLimit).map((item) =>
        item.candidate.attachRanking(item.candidate.dto, {
          bayesianScore: item.bayesianScore,
          rawAverageR: item.rawAverageR,
          validReviewsCountV: item.validReviewsCountV,
          globalAverageC,
          m,
          minReviews,
          isEligibleForRanking: false,
          rank: null,
        })
      )
    : [];

  return {
    ranked: slicedRanked,
    newlyRegistered: slicedNewlyRegistered,
    totalRankedEligible: eligible.length,
    totalNewlyRegistered: newlyRegisteredPool.length,
  };
}
