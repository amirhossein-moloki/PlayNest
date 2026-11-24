/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { setPublicCacheHeaders, withPublicCache } from '../../common/utils/publicCache';
import { buildShortUrl } from '../short-links/shortCode';

export const PublicAdvertisementsController = {
  async getSliderAdvertisements(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterSlug } = req.params as { gamingCenterSlug?: string };
      const cacheKey = `public:ads:slider:${gamingCenterSlug || 'global'}`;
      const hasShortLinks = typeof (prisma as any).shortLink?.findFirst === 'function';

      const formatted = await withPublicCache(cacheKey, 60, async () => {
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
            adType: true,
            category: true,
            destinationUrl: true,
            ...(hasShortLinks
              ? {
                shortLinkId: true,
                shortLink: { select: { code: true, status: true } },
              }
              : {}),
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

        return ads.map((ad: any) => ({
          id: ad.id,
          title: ad.title,
          description: ad.description,
          bannerUrl: ad.bannerUrl,
          mediaType: ad.mediaType,
          adType: ad.adType ?? 'GAMING_CENTER',
          category: ad.category ?? null,
          destinationUrl: ad.destinationUrl,
          shortLinkId: ad.shortLinkId ?? null,
          shortUrl:
            ad.shortLink?.code && ad.shortLink?.status === 'ACTIVE'
              ? buildShortUrl(ad.shortLink.code)
              : null,
          priority: ad.priority,
          startDate: ad.startDate,
          endDate: ad.endDate,
          gamingCenterName: ad.gamingCenter?.name ?? null,
          gamingCenterSlug: ad.gamingCenter?.slug ?? null,
        }));
      });

      setPublicCacheHeaders(res, 60, 120, 300);
      (res as any).ok(formatted);
    } catch (err) {
      next(err);
    }
  },
};
