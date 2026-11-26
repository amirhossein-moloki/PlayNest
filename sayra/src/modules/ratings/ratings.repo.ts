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
      repliedBy: {
        select: {
          fullName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findReviewsByGamingCenterId(gamingCenterId: string, status?: RatingStatus) {
  return prisma.rating.findMany({
    where: {
      gamingCenterId,
      ...(status ? { status } : {}),
    },
    include: {
      customerAccount: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      reservation: {
        select: {
          id: true,
          status: true,
          startTime: true,
          endTime: true,
        },
      },
      station: {
        select: {
          id: true,
          name: true,
        },
      },
      repliedBy: {
        select: {
          id: true,
          fullName: true,
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

export async function replyToReview(
  reviewId: string,
  gamingCenterId: string,
  replyComment: string,
  repliedById?: string
) {
  return prisma.rating.update({
    where: {
      id: reviewId,
      gamingCenterId,
    },
    data: {
      replyComment,
      replyAt: new Date(),
      repliedById: repliedById || null,
    },
    include: {
      customerAccount: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      station: {
        select: {
          id: true,
          name: true,
        },
      },
      repliedBy: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });
}

export async function deleteReviewReply(reviewId: string, gamingCenterId: string) {
  return prisma.rating.update({
    where: {
      id: reviewId,
      gamingCenterId,
    },
    data: {
      replyComment: null,
      replyAt: null,
      repliedById: null,
    },
  });
}

export async function findReviewById(reviewId: string, gamingCenterId: string) {
  return prisma.rating.findFirst({
    where: { id: reviewId, gamingCenterId },
  });
}

export async function findExistingReviewForReservation(
  reservationId: string,
  stationId: string | null
) {
  return prisma.rating.findFirst({
    where: {
      reservationId,
      stationId,
    },
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

export async function findSayraBaselineReviewBySlug(gamingCenterSlug: string) {
  return prisma.gamingCenter.findUnique({
    where: { slug: gamingCenterSlug },
    select: {
      id: true,
      sayraRating: true,
      sayraReviewComment: true,
      sayraRatedAt: true,
      verifiedAt: true,
      createdAt: true,
    },
  });
}
