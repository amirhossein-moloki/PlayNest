/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../../config/prisma';
import { GamingCenterVerificationStatus, Prisma } from '@prisma/client';

export const VerificationRepo = {
  async createVerification(data: {
    gamingCenterId: string;
    nationalCardUrl: string;
    idWithSelfieUrl: string;
    businessLicenseUrl: string;
    status: GamingCenterVerificationStatus;
  }) {
    return (prisma as any).gamingCenterVerification.create({
      data,
    });
  },

  async findLatestByGamingCenterId(gamingCenterId: string) {
    return (prisma as any).gamingCenterVerification.findFirst({
      where: { gamingCenterId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewerAdmin: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    });
  },

  async findById(id: string) {
    return (prisma as any).gamingCenterVerification.findUnique({
      where: { id },
      include: {
        gamingCenter: {
          select: {
            id: true,
            name: true,
            slug: true,
            verificationStatus: true,
            users: {
              where: { role: 'MANAGER' },
              select: { id: true, fullName: true, phone: true },
            },
          },
        },
        reviewerAdmin: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    });
  },

  async listVerifications(params: {
    where: Prisma.GamingCenterVerificationWhereInput;
    skip: number;
    take: number;
  }) {
    const [items, total] = await Promise.all([
      (prisma as any).gamingCenterVerification.findMany({
        where: params.where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          gamingCenter: {
            select: { id: true, name: true, slug: true, verificationStatus: true },
          },
          reviewerAdmin: {
            select: { id: true, fullName: true },
          },
        },
      }),
      (prisma as any).gamingCenterVerification.count({ where: params.where }),
    ]);

    return { items, total };
  },

  async updateVerification(id: string, data: Prisma.GamingCenterVerificationUpdateInput) {
    return (prisma as any).gamingCenterVerification.update({
      where: { id },
      data,
    });
  },

  async updateGamingCenterStatus(
    gamingCenterId: string,
    data: {
      verificationStatus: GamingCenterVerificationStatus;
      verifiedAt?: Date | null;
      rejectionReason?: string | null;
    }
  ) {
    return (prisma as any).gamingCenter.update({
      where: { id: gamingCenterId },
      data,
    });
  },

  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  },
};
