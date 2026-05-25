import { Request, Response, NextFunction } from 'express';
import { LinksService } from './links.station';

export const getLinks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId } = req.params;
    const links = await LinksService.getLinks(gamingCenterId);
    res.ok(links);
  } catch (error) {
    next(error);
  }
};

export const createLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId } = req.params;
    const link = await LinksService.createLink(gamingCenterId, req.body);
    res.created(link);
  } catch (error) {
    next(error);
  }
};

export const updateLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId, linkId } = req.params;
    const link = await LinksService.updateLink(gamingCenterId, linkId, req.body);
    res.ok(link);
  } catch (error) {
    next(error);
  }
};

export const deleteLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId, linkId } = req.params;
    await LinksService.deleteLink(gamingCenterId, linkId);
    res.noContent();
  } catch (error) {
    next(error);
  }
};
