/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';

export const PublicAdvertisementsController = {
  async getSliderAdvertisements(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterSlug } = req.params as { gamingCenterSlug?: string };
      const now = new Date();

      const where: any = {
        deletedAt: null,
        status: { in: ['APPROVED', 'ACTIVE'] },
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      };

      if (gamingCenterSlug) {
        where.gamingCenter = {
          slug: gamingCenterSlug,
          isActive: true,
        };
      }

      const ads = await (prisma as any).advertisementRequest.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 20,
        select: {
          id: true,
          title: true,
          description: true,
          bannerUrl: true,
          mediaType: true,
          destinationUrl: true,
          priority: true,
          startDate: true,
          endDate: true,
          gamingCenter: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      const formatted = ads.map((ad: any) => ({
        id: ad.id,
        title: ad.title,
        description: ad.description,
        bannerUrl: ad.bannerUrl,
        mediaType: ad.mediaType,
        destinationUrl: ad.destinationUrl,
        priority: ad.priority,
        startDate: ad.startDate,
        endDate: ad.endDate,
        gamingCenterName: ad.gamingCenter?.name ?? null,
        gamingCenterSlug: ad.gamingCenter?.slug ?? null,
      }));

      (res as any).ok(formatted);
    } catch (err) {
      next(err);
    }
  },
};
