import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';
import {
  CenterRatingAggregate,
  computeBayesianScore,
  computeGlobalAverageC,
  rankPublicGameCenters,
  RankableCenterCandidate,
} from '../../../../src/modules/public-gamecenters/bayesian.ranking';

interface MockDto {
  id: string;
  name: string;
  bayesianScore?: number;
  rawAverageR?: number;
  rank?: number | null;
  isEligibleForRanking?: boolean;
}

function makeCandidate(params: {
  id: string;
  name?: string;
  isActive?: boolean;
  verificationStatus?: string;
  createdAt?: Date;
  finalPrice?: number;
  sumRatings: number;
  validReviewsCount: number;
  latestReviewAt?: Date | null;
}): RankableCenterCandidate<MockDto> {
  return {
    id: params.id,
    isActive: params.isActive ?? true,
    verificationStatus: params.verificationStatus ?? 'APPROVED',
    createdAt: params.createdAt ?? new Date('2026-01-01T00:00:00Z'),
    finalPrice: params.finalPrice ?? 100000,
    ratingStats: {
      sumRatings: params.sumRatings,
      validReviewsCount: params.validReviewsCount,
      latestReviewAt: params.latestReviewAt ?? null,
    },
    dto: {
      id: params.id,
      name: params.name ?? params.id,
    },
    attachRanking: (dto, ranking) => ({
      ...dto,
      bayesianScore: ranking.bayesianScore,
      rawAverageR: ranking.rawAverageR,
      rank: ranking.rank,
      isEligibleForRanking: ranking.isEligibleForRanking,
    }),
  };
}

describe('Bayesian Average Gaming Center Ranking', () => {
  it('computes weighted globalAverageC across valid reviews and handles zero reviews safely', () => {
    const empty = computeGlobalAverageC([]);
    expect(empty).toEqual({ globalAverageC: 0, totalValidReviews: 0 });

    const stats: CenterRatingAggregate[] = [
      { sumRatings: 15, validReviewsCount: 3, latestReviewAt: null }, // avg 5.0
      { sumRatings: 6, validReviewsCount: 2, latestReviewAt: null }, // avg 3.0
      { sumRatings: 0, validReviewsCount: 0, latestReviewAt: null }, // ignored
    ];
    const result = computeGlobalAverageC(stats);
    // (15 + 6) / (3 + 2) = 21 / 5 = 4.2
    expect(result.globalAverageC).toBe(4.2);
    expect(result.totalValidReviews).toBe(5);
  });

  it('computes Bayesian score using (v / (v + m)) * R + (m / (v + m)) * C and returns 0 when v <= 0', () => {
    expect(computeBayesianScore(5, 0, 3, 4.2)).toBe(0);
    expect(computeBayesianScore(4.5, 3, 0, 4.2)).toBe(0);

    // v=6, m=3, R=4.8, C=4.2 => (6/9)*4.8 + (3/9)*4.2 = 3.2 + 1.4 = 4.6
    expect(computeBayesianScore(4.8, 6, 3, 4.2)).toBe(4.6);

    // Unrounded R: sumRatings=14, v=3 => R=4.666666..., C=4.0, m=3
    // (3/6)*(14/3) + (3/6)*4.0 = 2.333333... + 2.0 = 4.3333
    expect(computeBayesianScore(14 / 3, 3, 3, 4.0)).toBe(4.3333);
  });

  it('separates eligible ranked centers from newlyRegistered centers and never assigns synthetic rank to insufficient reviews', () => {
    const candidates = [
      makeCandidate({ id: 'gc-a', sumRatings: 15, validReviewsCount: 3 }), // R=5.0, v=3
      makeCandidate({ id: 'gc-b', sumRatings: 28, validReviewsCount: 7 }), // R=4.0, v=7
      makeCandidate({ id: 'gc-low-v', sumRatings: 10, validReviewsCount: 2 }), // v=2 < minReviews=3
      makeCandidate({ id: 'gc-zero-v', sumRatings: 0, validReviewsCount: 0 }), // v=0
    ];

    const { globalAverageC } = computeGlobalAverageC(candidates.map((c) => c.ratingStats));
    // total sum = 15+28+10 = 53, v = 12 => C = 4.4167
    const output = rankPublicGameCenters(candidates, {
      m: 3,
      minReviews: 3,
      globalAverageC,
      sort: 'bayesian',
      limit: 10,
      includeNewlyRegistered: true,
      newlyRegisteredLimit: 10,
    });

    expect(output.ranked).toHaveLength(2);
    expect(output.ranked.map((r) => r.id)).toEqual(['gc-a', 'gc-b']);
    expect(output.ranked[0].rank).toBe(1);
    expect(output.ranked[1].rank).toBe(2);
    expect(output.ranked[0].isEligibleForRanking).toBe(true);

    expect(output.newlyRegistered).toHaveLength(2);
    for (const nr of output.newlyRegistered) {
      expect(nr.isEligibleForRanking).toBe(false);
      expect(nr.rank).toBeNull();
    }
    const zeroCenter = output.newlyRegistered.find((item) => item.id === 'gc-zero-v');
    expect(zeroCenter?.bayesianScore).toBe(0);
    expect(zeroCenter?.rawAverageR).toBe(0);
  });

  it('supports configurable minReviews, m, and includeNewlyRegistered=false', () => {
    const candidates = [
      makeCandidate({ id: 'gc-3rev', sumRatings: 15, validReviewsCount: 3 }),
      makeCandidate({ id: 'gc-6rev', sumRatings: 27, validReviewsCount: 6 }),
    ];

    const outputStrict = rankPublicGameCenters(candidates, {
      m: 5,
      minReviews: 5,
      globalAverageC: 4.5,
      sort: 'bayesian',
      limit: 10,
      includeNewlyRegistered: false,
      newlyRegisteredLimit: 10,
    });

    expect(outputStrict.ranked.map((c) => c.id)).toEqual(['gc-6rev']);
    expect(outputStrict.totalRankedEligible).toBe(1);
    expect(outputStrict.totalNewlyRegistered).toBe(1);
    expect(outputStrict.newlyRegistered).toHaveLength(0);
  });

  it('applies deterministic tie-breaking: validReviewsCount -> latestReviewAt -> id', () => {
    const older = new Date('2026-09-01T10:00:00Z');
    const newer = new Date('2026-10-01T10:00:00Z');

    // All have R = 4.0 and C = 4.0 => identical Bayesian score = 4.0
    const candidates = [
      makeCandidate({
        id: 'gc-b',
        sumRatings: 12,
        validReviewsCount: 3,
        latestReviewAt: older,
      }),
      makeCandidate({
        id: 'gc-a',
        sumRatings: 12,
        validReviewsCount: 3,
        latestReviewAt: newer,
      }),
      makeCandidate({
        id: 'gc-more-reviews',
        sumRatings: 20,
        validReviewsCount: 5,
        latestReviewAt: older,
      }),
      makeCandidate({
        id: 'gc-a2',
        sumRatings: 12,
        validReviewsCount: 3,
        latestReviewAt: newer,
      }),
    ];

    const output = rankPublicGameCenters(candidates, {
      m: 3,
      minReviews: 3,
      globalAverageC: 4.0,
      sort: 'bayesian',
      limit: 10,
      includeNewlyRegistered: true,
      newlyRegisteredLimit: 10,
    });

    expect(output.ranked.map((c) => c.id)).toEqual([
      'gc-more-reviews',
      'gc-a',
      'gc-a2',
      'gc-b',
    ]);
  });

  it('strictly excludes inactive and unverified centers from both sections', () => {
    const candidates = [
      makeCandidate({
        id: 'gc-valid',
        isActive: true,
        verificationStatus: 'APPROVED',
        sumRatings: 15,
        validReviewsCount: 3,
      }),
      makeCandidate({
        id: 'gc-inactive',
        isActive: false,
        verificationStatus: 'APPROVED',
        sumRatings: 25,
        validReviewsCount: 5,
      }),
      makeCandidate({
        id: 'gc-pending',
        isActive: true,
        verificationStatus: 'PENDING_REVIEW',
        sumRatings: 25,
        validReviewsCount: 5,
      }),
      makeCandidate({
        id: 'gc-not-submitted',
        isActive: true,
        verificationStatus: 'NOT_SUBMITTED',
        sumRatings: 0,
        validReviewsCount: 0,
      }),
    ];

    const output = rankPublicGameCenters(candidates, {
      m: 3,
      minReviews: 3,
      globalAverageC: 5.0,
      sort: 'bayesian',
      limit: 10,
      includeNewlyRegistered: true,
      newlyRegisteredLimit: 10,
    });

    expect(output.ranked.map((c) => c.id)).toEqual(['gc-valid']);
    expect(output.newlyRegistered).toHaveLength(0);
  });

  it('audits the real 10-center Tabriz seed dataset: hides unverified seed defaults and ranks cleanly when approved', () => {
    const seedPath = path.resolve(
      __dirname,
      '../../../../prisma/seed/playnest_seed_dataset_10_centers.json'
    );
    const dataset = JSON.parse(fs.readFileSync(seedPath, 'utf-8')) as {
      gamingCenters: Array<{
        id: string;
        name: string;
        isActive?: boolean;
        verificationStatus?: string;
        city?: string;
      }>;
      reservations: Array<{ id: string; status: string }>;
      ratings: Array<{
        gamingCenterId: string;
        reservationId: string;
        score?: number;
        rating?: number;
        status?: string;
        createdAt?: string;
      }>;
    };

    expect(dataset.gamingCenters).toHaveLength(10);

    const reservationStatusById = new Map(
      dataset.reservations.map((r) => [r.id, r.status])
    );

    const statsByCenter = new Map<string, CenterRatingAggregate>();
    for (const r of dataset.ratings) {
      const resStatus = reservationStatusById.get(r.reservationId);
      const effectiveStatus = r.status ?? 'PUBLISHED';
      const numericScore = typeof r.score === 'number' ? r.score : r.rating;
      if (effectiveStatus !== 'PUBLISHED' || resStatus !== 'COMPLETED' || typeof numericScore !== 'number') {
        continue;
      }
      const prev = statsByCenter.get(r.gamingCenterId) ?? {
        sumRatings: 0,
        validReviewsCount: 0,
        latestReviewAt: null,
      };
      prev.sumRatings += numericScore;
      prev.validReviewsCount += 1;
      if (r.createdAt) {
        const dt = new Date(r.createdAt);
        if (!prev.latestReviewAt || dt.getTime() > prev.latestReviewAt.getTime()) {
          prev.latestReviewAt = dt;
        }
      }
      statsByCenter.set(r.gamingCenterId, prev);
    }

    // 1. Default seed status (none marked APPROVED in JSON -> NOT_SUBMITTED in DB) => 0 visible
    const defaultSeedCandidates = dataset.gamingCenters.map((gc) => {
      const stats = statsByCenter.get(gc.id) ?? {
        sumRatings: 0,
        validReviewsCount: 0,
        latestReviewAt: null,
      };
      return makeCandidate({
        id: gc.id,
        name: gc.name,
        isActive: gc.isActive !== false,
        verificationStatus: gc.verificationStatus ?? 'NOT_SUBMITTED',
        sumRatings: stats.sumRatings,
        validReviewsCount: stats.validReviewsCount,
        latestReviewAt: stats.latestReviewAt,
      });
    });

    const defaultOutput = rankPublicGameCenters(defaultSeedCandidates, {
      m: 3,
      minReviews: 3,
      globalAverageC: 4.5,
      sort: 'bayesian',
      limit: 10,
      includeNewlyRegistered: true,
      newlyRegisteredLimit: 10,
    });
    expect(defaultOutput.ranked).toHaveLength(0);
    expect(defaultOutput.newlyRegistered).toHaveLength(0);

    // 2. When explicitly approved in a controlled dev/test fixture, all 10 Tabriz centers rank
    const approvedCandidates = dataset.gamingCenters.map((gc) => {
      const stats = statsByCenter.get(gc.id) ?? {
        sumRatings: 0,
        validReviewsCount: 0,
        latestReviewAt: null,
      };
      return makeCandidate({
        id: gc.id,
        name: gc.name,
        isActive: true,
        verificationStatus: 'APPROVED',
        sumRatings: stats.sumRatings,
        validReviewsCount: stats.validReviewsCount,
        latestReviewAt: stats.latestReviewAt,
      });
    });

    const { globalAverageC, totalValidReviews } = computeGlobalAverageC(
      approvedCandidates.map((c) => c.ratingStats)
    );
    expect(totalValidReviews).toBeGreaterThanOrEqual(30);

    const approvedOutput = rankPublicGameCenters(approvedCandidates, {
      m: 3,
      minReviews: 3,
      globalAverageC,
      sort: 'bayesian',
      limit: 10,
      includeNewlyRegistered: true,
      newlyRegisteredLimit: 10,
    });

    expect(approvedOutput.ranked).toHaveLength(10);
    expect(approvedOutput.newlyRegistered).toHaveLength(0);
    for (let i = 1; i < approvedOutput.ranked.length; i += 1) {
      expect(approvedOutput.ranked[i - 1].bayesianScore!).toBeGreaterThanOrEqual(
        approvedOutput.ranked[i].bayesianScore!
      );
    }
  });
});
