import { Request, Response } from 'express';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { PageStatus, PageType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { renderPageDocument } from './page-renderer';

type PublicPageRequest = Request<{ gamingCenterSlug: string; pageSlug?: string }> & {
  tenant?: { gamingCenterId: string; gamingCenterSlug?: string };
};

export async function getPublicGamingCenterHome(req: PublicPageRequest, res: Response) {
  const { gamingCenterSlug } = req.params;
  let tenant = req.tenant;

  if (!tenant?.gamingCenterId) {
    if (!gamingCenterSlug) {
      throw new AppError('GamingCenter slug is missing from the request params.', httpStatus.BAD_REQUEST);
    }

    const gamingCenter = await prisma.gamingCenter.findUnique({
      where: { slug: gamingCenterSlug, isActive: true },
    });
    if (!gamingCenter) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }

    tenant = { gamingCenterId: gamingCenter.id, gamingCenterSlug: gamingCenter.slug };
  }

  const page = await prisma.page.findFirst({
    where: {
      gamingCenterId: tenant.gamingCenterId,
      type: PageType.HOME,
      status: PageStatus.PUBLISHED,
    },
    include: {
      sections: { orderBy: { sortOrder: 'asc' }, where: { isEnabled: true } },
      gamingCenter: { select: { siteSettings: true } },
    },
  });

  if (!page) {
    throw new AppError('Home page not found', httpStatus.NOT_FOUND);
  }

  const { sections, gamingCenter, ...pageData } = page;
  const html = renderPageDocument({
    page: pageData,
    siteSettings: gamingCenter?.siteSettings ?? null,
    sections,
    pageId: page.id,
  });
  res.status(200).type('html').send(html);
}

export async function getPublicPage(req: PublicPageRequest, res: Response) {
  const { pageSlug, gamingCenterSlug } = req.params;
  let tenant = req.tenant;

  if (!tenant?.gamingCenterId) {
    if (!gamingCenterSlug) {
      throw new AppError('GamingCenter slug is missing from the request params.', httpStatus.BAD_REQUEST);
    }

    const gamingCenter = await prisma.gamingCenter.findUnique({ where: { slug: gamingCenterSlug } });
    if (!gamingCenter) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }

    tenant = { gamingCenterId: gamingCenter.id, gamingCenterSlug: gamingCenter.slug };
  }

  const page = await prisma.page.findFirst({
    where: {
      gamingCenterId: tenant.gamingCenterId,
      slug: pageSlug,
      status: PageStatus.PUBLISHED,
    },
    include: {
      sections: { orderBy: { sortOrder: 'asc' }, where: { isEnabled: true } },
      gamingCenter: { select: { siteSettings: true } },
    },
  });

  if (page) {
    const updatedAt = page.updatedAt;
    const eTag = `W/"${updatedAt.getTime()}"`;
    const lastModified = updatedAt.toUTCString();

    res.setHeader('ETag', eTag);
    res.setHeader('Last-Modified', lastModified);

    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === eTag) {
      res.status(304).end();
      return;
    }

    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince) {
      const parsedModifiedSince = new Date(ifModifiedSince);
      if (!Number.isNaN(parsedModifiedSince.getTime()) && parsedModifiedSince >= updatedAt) {
        res.status(304).end();
        return;
      }
    }

    const { sections, gamingCenter, ...pageData } = page;
    const html = renderPageDocument({
      page: pageData,
      siteSettings: gamingCenter?.siteSettings ?? null,
      sections,
      pageId: page.id,
    });
    res.status(200).type('html').send(html);
    return;
  }

  const slugHistory = await prisma.pageSlugHistory.findFirst({
    where: {
      oldSlug: pageSlug,
      page: {
        gamingCenterId: tenant.gamingCenterId,
        status: PageStatus.PUBLISHED,
      },
    },
    include: {
      page: true,
    },
  });

  if (!slugHistory?.page) {
    throw new AppError('Page not found', httpStatus.NOT_FOUND);
  }

  res.redirect(
    301,
    `/api/v1/public/gamingCenters/${tenant.gamingCenterSlug}/pages/${slugHistory.page.slug}`
  );
}
