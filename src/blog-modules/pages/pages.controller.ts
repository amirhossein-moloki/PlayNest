import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { pagesStation } from './pages.station';
import catchAsync from '../../common/utils/catchAsync';

export const pagesController = {
  createPage: catchAsync(async (req: Request, res: Response) => {
    const actor = { id: req.actor!.id, actorType: req.actor!.actorType };
    const context = { ip: req.ip, userAgent: req.get('User-Agent') };
    const page = await pagesStation.createPage(
      { ...req.body, gamingCenterId: req.gamingCenterId! },
      actor,
      context
    );
    res.status(httpStatus.CREATED).send(page);
  }),

  updatePage: catchAsync(async (req: Request, res: Response) => {
    const actor = { id: req.actor!.id, actorType: req.actor!.actorType };
    const context = { ip: req.ip, userAgent: req.get('User-Agent') };
    const page = await pagesStation.updatePage(
      req.params.id,
      req.gamingCenterId!,
      req.body,
      actor,
      context
    );
    res.send(page);
  }),

  getPageById: catchAsync(async (req: Request, res: Response) => {
    const page = await pagesStation.getPageById(req.params.id, req.gamingCenterId!);
    res.send(page);
  }),

  getPageByPath: catchAsync(async (req: Request, res: Response) => {
    const page = await pagesStation.getPageByPath(req.query.path as string, req.gamingCenterId!);
    res.send(page);
  }),

  deletePage: catchAsync(async (req: Request, res: Response) => {
    const actor = { id: req.actor!.id, actorType: req.actor!.actorType };
    const context = { ip: req.ip, userAgent: req.get('User-Agent') };
    await pagesStation.deletePage(req.params.id, req.gamingCenterId!, actor, context);
    res.status(httpStatus.NO_CONTENT).send();
  }),

  listPages: catchAsync(async (req: Request, res: Response) => {
    const pages = await pagesStation.listPages(req.gamingCenterId!, req.query);
    res.send(pages);
  }),
};
