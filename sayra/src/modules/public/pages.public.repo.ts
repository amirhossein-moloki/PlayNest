import { PageStatus, PageType } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const PagesPublicRepo = {
  async findGamingCenterBySlug(slug: string) {
    return prisma.gamingCenter.findFirst({
      where: { slug, isActive: true, verificationStatus: 'APPROVED' },
    });
  },

  async findGamingCenterById(id: string) {
    return prisma.gamingCenter.findFirst({
      where: { id, isActive: true, verificationStatus: 'APPROVED' },
    });
  },

  async findPublishedHomePage(gamingCenterId: string) {
    return prisma.page.findFirst({
      where: {
        gamingCenterId,
        type: PageType.HOME,
        status: PageStatus.PUBLISHED,
      },
      include: {
        sections: { orderBy: { sortOrder: 'asc' }, where: { isEnabled: true } },
        gamingCenter: { select: { siteSettings: true } },
      },
    });
  },

  async findPublishedPageBySlug(gamingCenterId: string, slug: string) {
    return prisma.page.findFirst({
      where: {
        gamingCenterId,
        slug,
        status: PageStatus.PUBLISHED,
      },
      include: {
        sections: { orderBy: { sortOrder: 'asc' }, where: { isEnabled: true } },
        gamingCenter: { select: { siteSettings: true } },
      },
    });
  },

  async findPublishedPageByOldSlug(gamingCenterId: string, oldSlug: string) {
    return prisma.pageSlugHistory.findFirst({
      where: {
        oldSlug,
        page: {
          gamingCenterId,
          status: PageStatus.PUBLISHED,
        },
      },
      include: {
        page: true,
      },
    });
  },
};
