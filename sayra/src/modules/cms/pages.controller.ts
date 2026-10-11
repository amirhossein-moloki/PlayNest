import { Request, Response } from 'express';
import * as PagesStation from './pages.station';
import { CreatePageInput, UpdatePageInput } from './pages.types';
import { listPagesSchema } from './pages.validators';

export async function createPage(
  req: Request<{ gamingCenterId: string }, unknown, CreatePageInput>,
  res: Response
) {
  const { gamingCenterId } = req.params;
  const page = await PagesStation.createPage(gamingCenterId, req.body);
  res.created(page);
}

export async function listPages(req: Request<{ gamingCenterId: string }>, res: Response) {
  const { gamingCenterId } = req.params;
  const { query } = listPagesSchema.parse({ query: req.query });
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;

  const { pages, total } = await PagesStation.listPages(gamingCenterId, {
    status: query.status,
    type: query.type,
    limit,
    offset,
  });

  const totalItems = total;
  const pageSize = limit;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  res.ok(pages, {
    pagination: {
      totalItems,
      totalPages,
      pageSize,
      page,
    },
  });
}

export async function updatePage(
  req: Request<{ gamingCenterId: string; pageId: string }, unknown, UpdatePageInput>,
  res: Response
) {
  const { gamingCenterId, pageId } = req.params;
  const page = await PagesStation.updatePage(gamingCenterId, pageId, req.body);
  res.ok(page);
}

export async function getPage(
  req: Request<{ gamingCenterId: string; pageId: string }>,
  res: Response
) {
  const { gamingCenterId, pageId } = req.params;
  const page = await PagesStation.getPage(gamingCenterId, pageId);
  res.ok(page);
}
