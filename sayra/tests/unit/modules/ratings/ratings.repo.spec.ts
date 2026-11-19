import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as RatingsRepo from '../../../../src/modules/ratings/ratings.repo';
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
});
