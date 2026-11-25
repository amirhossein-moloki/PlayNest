import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as RatingsRepo from '../../../../src/modules/ratings/ratings.repo';
import * as RatingsStation from '../../../../src/modules/ratings/ratings.station';
import { RatingStatus } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('RatingsRepo', () => {
  const ratingMock = prismaMock.rating /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const resMock = prismaMock.reservation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  it('createReview', async () => {
    ratingMock.create.mockResolvedValue({ id: 'r-1' });
    await RatingsRepo.createReview('gc-1', 'ca-1', { reservationId: 'res-1', rating: 5 } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
    expect(ratingMock.create).toHaveBeenCalled();
  });

  it('findPublishedReviewsByGamingCenterSlug', async () => {
    ratingMock.findMany.mockResolvedValue([]);
    await RatingsRepo.findPublishedReviewsByGamingCenterSlug('slug');
    expect(ratingMock.findMany).toHaveBeenCalled();
  });

  it('updateReviewStatus', async () => {
    ratingMock.update.mockResolvedValue({ id: 'r-1' });
    await RatingsRepo.updateReviewStatus('r-1', 'gc-1', RatingStatus.HIDDEN);
    expect(ratingMock.update).toHaveBeenCalled();
  });

  it('findReviewById', async () => {
    ratingMock.findFirst.mockResolvedValue({ id: 'r-1' });
    await RatingsRepo.findReviewById('r-1', 'gc-1');
    expect(ratingMock.findFirst).toHaveBeenCalled();
  });

  it('findReservationForReview', async () => {
    resMock.findFirst.mockResolvedValue({ id: 'res-1' });
    await RatingsRepo.findReservationForReview('res-1', 'slug');
    expect(resMock.findFirst).toHaveBeenCalled();
  });

  it('findReviewsByGamingCenterId', async () => {
    ratingMock.findMany.mockResolvedValue([]);
    await RatingsRepo.findReviewsByGamingCenterId('gc-1');
    expect(ratingMock.findMany).toHaveBeenCalled();
  });

  it('replyToReview', async () => {
    ratingMock.update.mockResolvedValue({ id: 'r-1', replyComment: 'Thank you' });
    await RatingsRepo.replyToReview('r-1', 'gc-1', 'Thank you', 'u-1');
    expect(ratingMock.update).toHaveBeenCalled();
  });

  it('deleteReviewReply', async () => {
    ratingMock.update.mockResolvedValue({ id: 'r-1', replyComment: null });
    await RatingsRepo.deleteReviewReply('r-1', 'gc-1');
    expect(ratingMock.update).toHaveBeenCalled();
  });

  it('getPublishedReviews includes official Sayra review with active status below 50 reviews and inactive at 50+', async () => {
    const gcMock = prismaMock.gamingCenter as any;
    gcMock.findUnique.mockResolvedValue({
      id: 'gc-1',
      sayraRating: 4.5,
      sayraReviewComment: 'گیم‌نت تایید شده با تجهیزات استاندارد',
      sayraRatedAt: new Date('2026-10-01T00:00:00Z'),
      verifiedAt: new Date('2026-10-01T00:00:00Z'),
      createdAt: new Date('2026-09-01T00:00:00Z'),
    });

    // Case 1: 2 user reviews (< 50)
    ratingMock.findMany.mockResolvedValue([
      { id: 'r-1', rating: 5, status: RatingStatus.PUBLISHED },
      { id: 'r-2', rating: 4, status: RatingStatus.PUBLISHED },
    ]);
    const listUnder50 = await RatingsStation.getPublishedReviews('test-gc');
    expect(listUnder50).toHaveLength(3);
    expect((listUnder50[0] as any).isSayraOfficial).toBe(true);
    expect((listUnder50[0] as any).isActiveInScore).toBe(true);
    expect((listUnder50[0] as any).sayraWeight).toBe(0.4);

    // Case 2: 50 user reviews (>= 50)
    ratingMock.findMany.mockResolvedValue(
      Array.from({ length: 50 }, (_, idx) => ({
        id: `r-${idx}`,
        rating: 5,
        status: RatingStatus.PUBLISHED,
      }))
    );
    const list50Plus = await RatingsStation.getPublishedReviews('test-gc');
    expect(list50Plus).toHaveLength(51);
    expect((list50Plus[0] as any).isSayraOfficial).toBe(true);
    expect((list50Plus[0] as any).isActiveInScore).toBe(false);
    expect((list50Plus[0] as any).sayraWeight).toBe(0);
  });
});
