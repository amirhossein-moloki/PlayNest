import { prisma } from '../../config/prisma';
import { RatingStatus } from '@prisma/client';
import { SubmitReviewInput } from './ratings.types';
import { PlatformSettingsRepo } from '../platform-admin/settings.station';

export async function createReview(gamingCenterId: string, customerAccountId: string, input: SubmitReviewInput) {
  let defaultStatus: RatingStatus = RatingStatus.PUBLISHED;
  try {
    const globalSettings = await PlatformSettingsRepo.getSettings();
    if (globalSettings && globalSettings.reviewApprovalPolicy === 'MANUAL') {
      defaultStatus = RatingStatus.HIDDEN;
    }
  } catch {
    defaultStatus = RatingStatus.PUBLISHED;
  }

  return prisma.rating.create({
    data: {
      gamingCenterId,
      customerAccountId,
      reservationId: input.reservationId,
      stationId: input.stationId,
      rating: input.rating,
      comment: input.comment,
      status: defaultStatus,
    },
  });
}

export async function findPublishedReviewsByGamingCenterSlug(gamingCenterSlug: string) {
  return prisma.rating.findMany({
    where: {
      gamingCenter: { slug: gamingCenterSlug },
      status: RatingStatus.PUBLISHED,
    },
    include: {
      customerAccount: {
        select: {
          fullName: true,
        },
      },
      station: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateReviewStatus(reviewId: string, gamingCenterId: string, status: RatingStatus) {
  return prisma.rating.update({
    where: {
      id: reviewId,
      gamingCenterId, // Safety check
    },
    data: { status },
  });
}

export async function findReviewById(reviewId: string, gamingCenterId: string) {
  return prisma.rating.findFirst({
    where: { id: reviewId, gamingCenterId }
  });
}

export async function findReservationForReview(reservationId: string, gamingCenterSlug: string) {
  return prisma.reservation.findFirst({
    where: {
      id: reservationId,
      gamingCenter: { slug: gamingCenterSlug },
    },
  });
}
