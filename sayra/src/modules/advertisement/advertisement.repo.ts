/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const AdvertisementRepo = {
  async create(data: Prisma.AdvertisementRequestUncheckedCreateInput) {
    return (prisma as any).advertisementRequest.create({
      data,
      include: {
        gamingCenter: {
          select: { id: true, name: true, slug: true },
        },
        owner: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        media: true,
      },
    });
  },

  async findById(id: string, gamingCenterId?: string) {
    const where: Prisma.AdvertisementRequestWhereInput = { id };
    if (gamingCenterId) {
      where.gamingCenterId = gamingCenterId;
    }
    return (prisma as any).advertisementRequest.findFirst({
      where,
      include: {
        gamingCenter: {
          select: { id: true, name: true, slug: true },
        },
        owner: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        media: true,
        reviewedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  },

  async list(params: {
    where: Prisma.AdvertisementRequestWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.AdvertisementRequestOrderByWithRelationInput;
  }) {
    const [items, total] = await Promise.all([
      (prisma as any).advertisementRequest.findMany({
        where: params.where,
        skip: params.skip,
        take: params.take,
        orderBy: params.orderBy,
        include: {
          gamingCenter: {
            select: { id: true, name: true, slug: true },
          },
          owner: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
          media: true,
        },
      }),
      (prisma as any).advertisementRequest.count({
        where: params.where,
      }),
    ]);
    return { items, total };
  },

  async update(id: string, data: Prisma.AdvertisementRequestUpdateInput) {
    return (prisma as any).advertisementRequest.update({
      where: { id },
      data,
      include: {
        gamingCenter: {
          select: { id: true, name: true, slug: true },
        },
        owner: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        media: true,
      },
    });
  },
};
