import { Request, Response } from 'express';
import { PagesPublicStation } from './pages.public.station';
import { gamingCenterStation } from '../gamingCenter/gamingCenter.station';
import { getGamingCenterDetailsSchema } from '../gamingCenter/gamingCenter.validation';
import {
  buildSortedCacheKey,
  setPublicCacheHeaders,
  withPublicCache,
} from '../../common/utils/publicCache';

type PublicPageRequest = Request<{ gamingCenterSlug: string; pageSlug?: string }> & {
  tenant?: { gamingCenterId: string; gamingCenterSlug?: string };
};

export async function getPublicGamingCenterHome(req: PublicPageRequest, res: Response) {
  const { gamingCenterSlug } = req.params;

  // If client requests JSON or not explicitly accepting HTML, return JSON gaming center details as documented in OpenAPI
  const accepts = req.headers.accept || '';
  const isHtmlExpected = accepts.includes('text/html') && !accepts.includes('application/json');

  if (isHtmlExpected) {
    try {
      const result = await PagesPublicStation.getGamingCenterHome(
        gamingCenterSlug,
        req.tenant?.gamingCenterId
      );

      res.setHeader('ETag', result.eTag);
      res.setHeader('Last-Modified', result.lastModified);
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.status(200).type('html').send(result.html);
      return;
    } catch {
      // Fallback to JSON if no home page exists
    }
  }

  const validatedQuery = getGamingCenterDetailsSchema.parse(req.query);
  const centerLookupId = req.tenant?.gamingCenterId || gamingCenterSlug;
  const cacheKey = buildSortedCacheKey(`public:gc:detail:${centerLookupId}`, {
    include: validatedQuery.include?.join(','),
    fields: validatedQuery.fields?.join(','),
  });
  const gamingCenter = await withPublicCache(cacheKey, 60, () =>
    gamingCenterStation.getGamingCenterById(centerLookupId, validatedQuery)
  );
  setPublicCacheHeaders(res, 60, 120, 300);
  res.ok(gamingCenter);
}

export async function getPublicPage(req: PublicPageRequest, res: Response) {
  const { pageSlug, gamingCenterSlug } = req.params;
  if (!pageSlug) {
    res.status(400).json({ message: 'Page slug is required' });
    return;
  }

  const result = await PagesPublicStation.getPage(
    pageSlug,
    gamingCenterSlug,
    req.tenant,
    {
      ifNoneMatch: req.headers['if-none-match'] as string,
      ifModifiedSince: req.headers['if-modified-since'] as string,
    }
  );

  switch (result.type) {
  case 'NOT_MODIFIED':
    res.status(304).end();
    break;
  case 'REDIRECT':
    res.redirect(301, result.url);
    break;
  case 'RENDER':
    res.setHeader('ETag', result.eTag);
    res.setHeader('Last-Modified', result.lastModified);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.status(200).type('html').send(result.html);
    break;
  }
}
