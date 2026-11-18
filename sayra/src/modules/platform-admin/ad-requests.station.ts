/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { Prisma, AdvertisementRequestStatus, AdvertisementType, MediaType } from '@prisma/client';
import { PlatformAdRequestsRepo } from './ad-requests.repo';
import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';
import { auditService } from '../audit/audit.station';

export const PlatformAdRequestsStation = {
  /**
   * Helper to format single ad request object according to specification
   */
  formatAdRequest(item: any) {
    if (!item) return null;

    const primaryAddress =
      item.gamingCenter?.addresses?.find((a: any) => a.isPrimary) ||
      item.gamingCenter?.addresses?.[0];

    const ownerNames = item.owner?.fullName?.trim().split(' ') || [];
    const firstName = ownerNames[0] || '';
    const lastName = ownerNames.slice(1).join(' ') || '';

    // Check expiry dynamically if approved or active
    const now = new Date();
    let computedStatus = item.status;
    if (item.status === 'APPROVED' || item.status === 'ACTIVE') {
      if (item.endDate && new Date(item.endDate) < now) {
        computedStatus = 'EXPIRED';
      } else if (item.startDate && new Date(item.startDate) <= now) {
        computedStatus = 'ACTIVE';
      } else {
        computedStatus = 'APPROVED';
      }
    }

    let remainingDays: number | null = null;
    if (item.endDate && (computedStatus === 'ACTIVE' || computedStatus === 'APPROVED')) {
      const diffTime = new Date(item.endDate).getTime() - now.getTime();
      remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    return {
      id: item.id,
      title: item.title,
      description: item.description,
      bannerUrl: item.bannerUrl,
      mediaType: item.mediaType,
      adType: item.adType ?? AdvertisementType.GAMING_CENTER,
      category: item.category ?? null,
      destinationUrl: item.destinationUrl,
      proposedDurationDays: item.proposedDurationDays ?? 30,
      durationDays: item.durationDays,
      priority: item.priority ?? 0,
      startDate: item.startDate,
      endDate: item.endDate,
      status: computedStatus,
      decisionReason: item.decisionReason,
      reviewedBy: item.reviewedBy
        ? {
          id: item.reviewedBy.id,
          fullName: item.reviewedBy.fullName,
          email: item.reviewedBy.email,
        }
        : null,
      reviewedAt: item.reviewedAt,
      adminNote: item.adminNote,
      gamingCenter: item.gamingCenter
        ? {
          id: item.gamingCenter.id,
          name: item.gamingCenter.name,
          slug: item.gamingCenter.slug,
          city: primaryAddress?.city || null,
          address: primaryAddress?.addressLine || null,
        }
        : null,
      owner: item.owner
        ? {
          id: item.owner.id,
          firstName,
          lastName,
          fullName: item.owner.fullName,
          phone: item.owner.phone,
          email: item.owner.email,
        }
        : null,
      media: item.media
        ? {
          id: item.media.id,
          url: item.media.url,
          thumbUrl: item.media.thumbUrl,
          type: item.media.type,
          mime: item.media.mime,
          sizeBytes: item.media.sizeBytes,
        }
        : null,
      remainingDays,
      deletedAt: item.deletedAt ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  },

  /**
   * List advertisement requests with comprehensive filtering and pagination
   */
  async listAdRequests(query: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    adType?: string;
    gamingCenterId?: string;
    ownerId?: string;
    city?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.AdvertisementRequestWhereInput = {};

    if (query.gamingCenterId) {
      where.gamingCenterId = query.gamingCenterId;
    }

    if (query.ownerId) {
      where.ownerId = query.ownerId;
    }

    if (query.status) {
      where.status = query.status as AdvertisementRequestStatus;
    }

    if (query.adType) {
      where.adType = query.adType as AdvertisementType;
    }

    if (query.city) {
      where.gamingCenter = {
        addresses: {
          some: {
            city: { contains: query.city, mode: 'insensitive' },
          },
        },
      };
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    if (query.search) {
      const searchTerms = query.search.trim();
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { title: { contains: searchTerms, mode: 'insensitive' } },
            { gamingCenter: { name: { contains: searchTerms, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const sortField = query.sortBy || 'createdAt';
    const sortDir = (query.sortOrder || 'desc').toLowerCase() as 'asc' | 'desc';
    const orderBy: Prisma.AdvertisementRequestOrderByWithRelationInput = {
      [sortField]: sortDir,
    };

    const { items, total } = await PlatformAdRequestsRepo.listAdRequests({
      skip,
      take: query.limit,
      where,
      orderBy,
    });

    const transformedItems = items.map((item: any) => this.formatAdRequest(item));

    return {
      items: transformedItems,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  },

  /**
   * Get single advertisement request details
   */
  async getAdRequestById(id: string) {
    const adRequest = await PlatformAdRequestsRepo.findById(id);
    if (!adRequest) {
      throw new AppError('Advertisement request not found', httpStatus.NOT_FOUND);
    }

    return this.formatAdRequest(adRequest);
  },

  /**
   * Update status (APPROVE / REJECT) of an advertisement request
   */
  async updateAdRequestStatus(
    id: string,
    body: {
      status: 'APPROVED' | 'REJECTED';
      decisionReason?: string;
      adminNote?: string;
      startDate?: string;
      endDate?: string;
      durationDays?: number;
      priority?: number;
    },
    adminActor: { id: string; actorType?: string },
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await PlatformAdRequestsRepo.findById(id);
    if (!existing) {
      throw new AppError('Advertisement request not found', httpStatus.NOT_FOUND);
    }

    // Business rule: Once decided (APPROVED or REJECTED) or deleted, requests cannot be re-evaluated
    if (existing.status !== 'PENDING') {
      throw new AppError(
        `Cannot update status: advertisement request is already in ${existing.status} status`,
        httpStatus.CONFLICT
      );
    }

    const now = new Date();
    const adminId = adminActor.id || (adminActor as any).actorId;

    let updateData: any = {
      status: body.status,
      reviewedById: adminId,
      reviewedAt: now,
      decisionReason: body.decisionReason ?? null,
      adminNote: body.adminNote ?? existing.adminNote,
    };

    if (body.status === 'APPROVED') {
      const startDate = body.startDate ? new Date(body.startDate) : (existing.startDate ? new Date(existing.startDate) : now);
      const durationDays = body.durationDays ?? existing.durationDays ?? 30;

      let endDate: Date;
      if (body.endDate) {
        endDate = new Date(body.endDate);
      } else {
        endDate = new Date(startDate.getTime());
        endDate.setDate(endDate.getDate() + durationDays);
      }

      // If ad start date has already arrived, set status to ACTIVE immediately
      const initialApprovedStatus = startDate <= now ? 'ACTIVE' : 'APPROVED';

      updateData = {
        ...updateData,
        status: initialApprovedStatus,
        startDate,
        durationDays,
        endDate,
        priority: body.priority !== undefined ? body.priority : (existing.priority ?? 0),
      };
    } else if (body.status === 'REJECTED') {
      if (!body.decisionReason || body.decisionReason.trim() === '') {
        throw new AppError('decisionReason is required when rejecting an advertisement request', httpStatus.BAD_REQUEST);
      }
    }

    const updated = await PlatformAdRequestsRepo.transaction(async (tx: any) => {
      const record = await tx.advertisementRequest.update({
        where: { id },
        data: updateData,
        include: {
          gamingCenter: {
            select: {
              id: true,
              name: true,
              slug: true,
              addresses: {
                select: {
                  city: true,
                  addressLine: true,
                  isPrimary: true,
                },
              },
            },
          },
          owner: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          media: {
            select: {
              id: true,
              url: true,
              thumbUrl: true,
              type: true,
              mime: true,
              sizeBytes: true,
            },
          },
        },
      });

      return record;
    });

    // Create Audit Log entry for the administrative action
    await auditService.recordLog({
      gamingCenterId: existing.gamingCenterId,
      platformAdminId: adminId,
      action: body.status === 'APPROVED' ? 'ADVERTISEMENT_REQUEST_APPROVED' : 'ADVERTISEMENT_REQUEST_REJECTED',
      entity: 'AdvertisementRequest',
      entityId: id,
      oldData: {
        status: existing.status,
        decisionReason: existing.decisionReason,
        reviewedById: existing.reviewedById,
        reviewedAt: existing.reviewedAt,
      },
      newData: {
        status: updated.status,
        decisionReason: updated.decisionReason,
        adminNote: updated.adminNote,
        reviewedById: updated.reviewedById,
        reviewedAt: updated.reviewedAt,
        startDate: updated.startDate,
        endDate: updated.endDate,
        durationDays: updated.durationDays,
      },
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    return this.formatAdRequest(updated);
  },

  /**
   * Delete an advertisement request by Platform Admin (soft delete)
   */
  async deleteAdRequest(
    id: string,
    adminActor: { id: string; actorType?: string },
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await PlatformAdRequestsRepo.findById(id);
    if (!existing || existing.deletedAt) {
      throw new AppError('Advertisement request not found', httpStatus.NOT_FOUND);
    }

    const adminId = adminActor.id || (adminActor as any).actorId;
    const now = new Date();

    const updated = await PlatformAdRequestsRepo.transaction(async (tx: any) => {
      return tx.advertisementRequest.update({
        where: { id },
        data: {
          status: 'DELETED',
          deletedAt: now,
        },
        include: {
          gamingCenter: {
            select: {
              id: true,
              name: true,
              slug: true,
              addresses: {
                select: {
                  city: true,
                  addressLine: true,
                  isPrimary: true,
                },
              },
            },
          },
          owner: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          media: {
            select: {
              id: true,
              url: true,
              thumbUrl: true,
              type: true,
              mime: true,
              sizeBytes: true,
            },
          },
        },
      });
    });

    await auditService.recordLog({
      gamingCenterId: existing.gamingCenterId,
      platformAdminId: adminId,
      action: 'ADVERTISEMENT_REQUEST_DELETED',
      entity: 'AdvertisementRequest',
      entityId: id,
      oldData: {
        status: existing.status,
      },
      newData: {
        status: 'DELETED',
        deletedAt: now,
      },
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    return this.formatAdRequest(updated);
  },

  /**
   * Direct advertisement creation by Platform Admin (with or without a GamingCenter)
   */
  async createAdRequest(
    input: {
      title: string;
      description?: string | null;
      bannerUrl: string;
      mediaType?: MediaType;
      adType?: 'GAMING_CENTER' | 'GLOBAL_PROMOTION' | 'CATEGORY' | 'CUSTOM_LINK';
      category?: string | null;
      destinationUrl?: string | null;
      gamingCenterId?: string | null;
      ownerId?: string | null;
      mediaId?: string | null;
      status?: 'APPROVED' | 'PENDING';
      durationDays?: number;
      priority?: number;
      startDate?: string;
      endDate?: string;
      adminNote?: string | null;
    },
    actor: { id: string; actorType?: string },
    context?: { ip?: string; userAgent?: string }
  ) {
    const adminId = actor?.id;
    if (!adminId) {
      throw new AppError('Unauthorized platform admin actor', httpStatus.UNAUTHORIZED);
    }

    const gamingCenterId = input.gamingCenterId || null;
    const ownerId = input.ownerId || null;
    const mediaId = input.mediaId || null;

    if (gamingCenterId) {
      const center = await prisma.gamingCenter.findUnique({
        where: { id: gamingCenterId },
        select: { id: true },
      });
      if (!center) {
        throw new AppError('Gaming center not found', httpStatus.NOT_FOUND);
      }
    }

    if (ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true },
      });
      if (!owner) {
        throw new AppError('Owner user not found', httpStatus.NOT_FOUND);
      }
    }

    if (mediaId) {
      const media = await prisma.media.findUnique({
        where: { id: mediaId },
        select: { id: true },
      });
      if (!media) {
        throw new AppError('Media not found', httpStatus.NOT_FOUND);
      }
    }

    // Resolve adType automatically if not explicitly provided
    let resolvedAdType: AdvertisementType;
    if (input.adType) {
      resolvedAdType = input.adType as AdvertisementType;
    } else if (gamingCenterId) {
      resolvedAdType = AdvertisementType.GAMING_CENTER;
    } else if (input.category) {
      resolvedAdType = AdvertisementType.CATEGORY;
    } else if (input.destinationUrl) {
      resolvedAdType = AdvertisementType.CUSTOM_LINK;
    } else {
      resolvedAdType = AdvertisementType.GLOBAL_PROMOTION;
    }

    const status = (input.status || 'APPROVED') as AdvertisementRequestStatus;
    const durationDays = input.durationDays ?? 30;
    const now = new Date();

    let startDate: Date | null = input.startDate ? new Date(input.startDate) : null;
    let endDate: Date | null = input.endDate ? new Date(input.endDate) : null;

    if (status === AdvertisementRequestStatus.APPROVED) {
      if (!startDate) {
        startDate = now;
      }
      if (!endDate) {
        endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
      }
    }

    const created = await PlatformAdRequestsRepo.createAdRequest({
      title: input.title,
      description: input.description ?? null,
      bannerUrl: input.bannerUrl,
      mediaType: input.mediaType ?? MediaType.IMAGE,
      adType: resolvedAdType,
      category: input.category ?? null,
      destinationUrl: input.destinationUrl || null,
      proposedDurationDays: durationDays,
      durationDays,
      priority: input.priority ?? 0,
      startDate,
      endDate,
      gamingCenterId,
      ownerId,
      mediaId,
      status,
      reviewedById: status === AdvertisementRequestStatus.APPROVED ? adminId : null,
      reviewedAt: status === AdvertisementRequestStatus.APPROVED ? now : null,
      adminNote: input.adminNote ?? null,
    });

    await auditService.recordLog({
      gamingCenterId: gamingCenterId ?? undefined,
      platformAdminId: adminId,
      action: 'ADVERTISEMENT_CREATED_BY_PLATFORM_ADMIN',
      entity: 'AdvertisementRequest',
      entityId: created.id,
      oldData: undefined,
      newData: {
        title: created.title,
        adType: resolvedAdType,
        status,
        gamingCenterId,
        ownerId,
      },
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    return this.formatAdRequest(created);
  },
};
