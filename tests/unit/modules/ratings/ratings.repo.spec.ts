import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as RatingsRepo from '../../../../src/modules/ratings/ratings.repo';
import { RatingStatus } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('RatingsRepo', () => {
  const ratingMock = prismaMock.rating as any;
  const resMock = prismaMock.reservation as any;

  it('createReview', async () => {
    ratingMock.create.mockResolvedValue({ id: 'r-1' });
    await RatingsRepo.createReview('gc-1', 'ca-1', { reservationId: 'res-1', rating: 5 } as any);
    expect(ratingMock.create).toHaveBeenCalled();
  });

  it('findPublishedReviewsBySalonSlug', async () => {
    ratingMock.findMany.mockResolvedValue([]);
    await RatingsRepo.findPublishedReviewsBySalonSlug('slug');
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

  it('findBookingForReview', async () => {
    resMock.findFirst.mockResolvedValue({ id: 'res-1' });
    await RatingsRepo.findBookingForReview('res-1', 'slug');
    expect(resMock.findFirst).toHaveBeenCalled();
  });
});
