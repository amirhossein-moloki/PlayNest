import { Request, Response } from 'express';
import { PagesPublicStation } from './pages.public.station';

type PublicPageRequest = Request<{ gamingCenterSlug: string; pageSlug?: string }> & {
  tenant?: { gamingCenterId: string; gamingCenterSlug?: string };
};

export async function getPublicGamingCenterHome(req: PublicPageRequest, res: Response) {
  const { gamingCenterSlug } = req.params;
  const result = await PagesPublicStation.getGamingCenterHome(
    gamingCenterSlug,
    req.tenant?.gamingCenterId
  );

  res.setHeader('ETag', result.eTag);
  res.setHeader('Last-Modified', result.lastModified);
  res.status(200).type('html').send(result.html);
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
      res.status(200).type('html').send(result.html);
      break;
  }
}
