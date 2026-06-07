import httpStatus from 'http-status';
import AppError from '../../common/errors/AppError';
import { PagesPublicRepo } from './pages.public.repo';
import { renderPageDocument } from './page-renderer';

export interface PageRenderResult {
  type: 'RENDER';
  html: string;
  eTag: string;
  lastModified: string;
}

export interface NotModifiedResult {
  type: 'NOT_MODIFIED';
}

export interface RedirectResult {
  type: 'REDIRECT';
  url: string;
}

export const PagesPublicStation = {
  async getGamingCenterHome(gamingCenterSlug?: string, tenantId?: string) {
    let gamingCenterId = tenantId;

    if (!gamingCenterId) {
      if (!gamingCenterSlug) {
        throw new AppError('GamingCenter slug is missing', httpStatus.BAD_REQUEST);
      }
      const gamingCenter = await PagesPublicRepo.findGamingCenterBySlug(gamingCenterSlug);
      if (!gamingCenter) {
        throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
      }
      gamingCenterId = gamingCenter.id;
    }

    const page = await PagesPublicRepo.findPublishedHomePage(gamingCenterId);
    if (!page) {
      throw new AppError('Home page not found', httpStatus.NOT_FOUND);
    }

    const { sections, gamingCenter, ...pageData } = page;
    const html = renderPageDocument({
      page: pageData,
      siteSettings: (gamingCenter as { siteSettings: any } | null)?.siteSettings ?? null,
      sections,
      pageId: page.id,
    });

    const updatedAt = page.updatedAt;
    return {
      type: 'RENDER' as const,
      html,
      eTag: `W/"${updatedAt.getTime()}"`,
      lastModified: updatedAt.toUTCString(),
    };
  },

  async getPage(
    pageSlug: string,
    gamingCenterSlug?: string,
    tenant?: { gamingCenterId: string; gamingCenterSlug?: string },
    headers?: { ifNoneMatch?: string; ifModifiedSince?: string }
  ): Promise<PageRenderResult | NotModifiedResult | RedirectResult> {
    let activeTenant = tenant;

    if (!activeTenant?.gamingCenterId) {
      if (!gamingCenterSlug) {
        throw new AppError('GamingCenter slug is missing', httpStatus.BAD_REQUEST);
      }
      const gamingCenter = await PagesPublicRepo.findGamingCenterBySlug(gamingCenterSlug);
      if (!gamingCenter) {
        throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
      }
      activeTenant = { gamingCenterId: gamingCenter.id, gamingCenterSlug: gamingCenter.slug };
    }

    const page = await PagesPublicRepo.findPublishedPageBySlug(activeTenant.gamingCenterId, pageSlug);

    if (page) {
      const updatedAt = page.updatedAt;
      const eTag = `W/"${updatedAt.getTime()}"`;
      const lastModified = updatedAt.toUTCString();

      if (headers?.ifNoneMatch === eTag) {
        return { type: 'NOT_MODIFIED' };
      }

      if (headers?.ifModifiedSince) {
        const parsedModifiedSince = new Date(headers.ifModifiedSince);
        if (!Number.isNaN(parsedModifiedSince.getTime()) && parsedModifiedSince >= updatedAt) {
          return { type: 'NOT_MODIFIED' };
        }
      }

      const { sections, gamingCenter, ...pageData } = page;
      const html = renderPageDocument({
        page: pageData,
        siteSettings: (gamingCenter as { siteSettings: any } | null)?.siteSettings ?? null,
        sections,
        pageId: page.id,
      });

      return {
        type: 'RENDER',
        html,
        eTag,
        lastModified,
      };
    }

    const slugHistory = await PagesPublicRepo.findPublishedPageByOldSlug(
      activeTenant.gamingCenterId,
      pageSlug
    );

    if (!slugHistory?.page) {
      throw new AppError('Page not found', httpStatus.NOT_FOUND);
    }

    return {
      type: 'REDIRECT',
      url: `/api/v1/public/gamingCenters/${activeTenant.gamingCenterSlug}/pages/${slugHistory.page.slug}`,
    };
  },
};
