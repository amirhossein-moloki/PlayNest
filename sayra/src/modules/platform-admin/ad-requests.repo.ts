/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const PlatformAdRequestsRepo = {
  async listAdRequests(params: {
    skip: number;
    take: number;
    where: Prisma.AdvertisementRequestWhereInput;
    orderBy: Prisma.AdvertisementRequestOrderByWithRelationInput | Prisma.AdvertisementRequestOrderByWithRelationInput[];
  }) {
    const [items, total] = await Promise.all([
      (prisma as any).advertisementRequest.findMany({
        where: params.where,
        skip: params.skip,
        take: params.take,
        orderBy: params.orderBy,
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
      }),
      (prisma as any).advertisementRequest.count({
        where: params.where,
      }),
    ]);

    return { items, total };
  },

  async findById(id: string) {
    return (prisma as any).advertisementRequest.findUnique({
      where: { id },
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
  },

  async transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return (prisma as any).$transaction(callback);
  },
};
