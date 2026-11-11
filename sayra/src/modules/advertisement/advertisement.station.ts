/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { AdvertisementRequestStatus, Prisma } from '@prisma/client';
import { AdvertisementRepo } from './advertisement.repo';
import AppError from '../../common/errors/AppError';
import {
  CreateAdvertisementDto,
  UpdateAdvertisementDto,
  AdvertisementResponse,
} from './advertisement.types';

export const AdvertisementStation = {
  formatAdvertisement(item: any): AdvertisementResponse {
    const now = new Date();
    let computedStatus = item.status;

    if (item.status === AdvertisementRequestStatus.APPROVED || item.status === AdvertisementRequestStatus.ACTIVE) {
      if (item.endDate && new Date(item.endDate) < now) {
        computedStatus = AdvertisementRequestStatus.EXPIRED;
      } else if (item.startDate && new Date(item.startDate) <= now) {
        computedStatus = AdvertisementRequestStatus.ACTIVE;
      } else {
        computedStatus = AdvertisementRequestStatus.APPROVED;
      }
    }

    let remainingDays: number | null = null;
    if (item.endDate && (computedStatus === AdvertisementRequestStatus.ACTIVE || computedStatus === AdvertisementRequestStatus.APPROVED)) {
      const diffTime = new Date(item.endDate).getTime() - now.getTime();
      remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    return {
      id: item.id,
      title: item.title,
      description: item.description ?? null,
      bannerUrl: item.bannerUrl,
      mediaType: item.mediaType,
      destinationUrl: item.destinationUrl ?? null,
      proposedDurationDays: item.proposedDurationDays ?? 30,
      durationDays: item.durationDays ?? 30,
      priority: item.priority ?? 0,
      startDate: item.startDate ?? null,
      endDate: item.endDate ?? null,
      status: computedStatus,
      decisionReason: item.decisionReason ?? null,
      adminNote: item.adminNote ?? null,
      gamingCenterId: item.gamingCenterId,
      ownerId: item.ownerId,
      remainingDays,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      deletedAt: item.deletedAt ?? null,
    };
  },

  async createAdvertisement(
    gamingCenterId: string,
    ownerId: string,
    dto: CreateAdvertisementDto
  ): Promise<AdvertisementResponse> {
    const duration = dto.proposedDurationDays ?? 30;

    const record = await AdvertisementRepo.create({
      title: dto.title,
      description: dto.description,
      bannerUrl: dto.bannerUrl,
      destinationUrl: dto.destinationUrl || null,
      mediaType: dto.mediaType,
      mediaId: dto.mediaId,
      proposedDurationDays: duration,
      durationDays: duration,
      status: AdvertisementRequestStatus.PENDING,
      gamingCenterId,
      ownerId,
    });

    return this.formatAdvertisement(record);
  },

  async listAdvertisements(
    gamingCenterId: string,
    query: {
      page?: number;
      limit?: number;
      status?: AdvertisementRequestStatus;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
    }
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AdvertisementRequestWhereInput = {
      gamingCenterId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.title = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const sortField = query.sortBy || 'createdAt';
    const sortDir = (query.sortOrder || 'desc').toLowerCase() as 'asc' | 'desc';
    const orderBy: Prisma.AdvertisementRequestOrderByWithRelationInput = {
      [sortField]: sortDir,
    };

    const { items, total } = await AdvertisementRepo.list({
      where,
      skip,
      take: limit,
      orderBy,
    });

    return {
      items: items.map((i: any) => this.formatAdvertisement(i)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async getAdvertisementById(id: string, gamingCenterId: string): Promise<AdvertisementResponse> {
    const item = await AdvertisementRepo.findById(id, gamingCenterId);
    if (!item || item.deletedAt) {
      throw new AppError('Advertisement not found', httpStatus.NOT_FOUND);
    }
    return this.formatAdvertisement(item);
  },

  async updateAdvertisement(
    id: string,
    gamingCenterId: string,
    dto: UpdateAdvertisementDto
  ): Promise<AdvertisementResponse> {
    const existing = await AdvertisementRepo.findById(id, gamingCenterId);
    if (!existing || existing.deletedAt) {
      throw new AppError('Advertisement not found', httpStatus.NOT_FOUND);
    }

    if (existing.status !== AdvertisementRequestStatus.PENDING) {
      throw new AppError('Only pending advertisement requests can be modified', httpStatus.BAD_REQUEST);
    }

    const updateData: Prisma.AdvertisementRequestUpdateInput = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.bannerUrl !== undefined) updateData.bannerUrl = dto.bannerUrl;
    if (dto.destinationUrl !== undefined) updateData.destinationUrl = dto.destinationUrl || null;
    if (dto.mediaType !== undefined) updateData.mediaType = dto.mediaType;
    if (dto.mediaId !== undefined) {
      updateData.media = dto.mediaId ? { connect: { id: dto.mediaId } } : { disconnect: true };
    }
    if (dto.proposedDurationDays !== undefined) {
      updateData.proposedDurationDays = dto.proposedDurationDays;
      updateData.durationDays = dto.proposedDurationDays;
    }

    const updated = await AdvertisementRepo.update(id, updateData);
    return this.formatAdvertisement(updated);
  },

  async deleteAdvertisement(id: string, gamingCenterId: string): Promise<void> {
    const existing = await AdvertisementRepo.findById(id, gamingCenterId);
    if (!existing || existing.deletedAt) {
      throw new AppError('Advertisement not found', httpStatus.NOT_FOUND);
    }

    await AdvertisementRepo.update(id, {
      status: AdvertisementRequestStatus.DELETED,
      deletedAt: new Date(),
    });
  },
};
