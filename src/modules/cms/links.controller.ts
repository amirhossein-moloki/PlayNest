import { Request, Response, NextFunction } from 'express';
import { LinksStation } from './links.station';

export const getLinks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId } = req.params;
    const links = await LinksStation.getLinks(gamingCenterId);
    res.ok(links);
  } catch (error) {
    next(error);
  }
};

export const createLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId } = req.params;
    const link = await LinksStation.createLink(gamingCenterId, req.body);
    res.created(link);
  } catch (error) {
    next(error);
  }
};

export const updateLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId, linkId } = req.params;
    const link = await LinksStation.updateLink(gamingCenterId, linkId, req.body);
    res.ok(link);
  } catch (error) {
    next(error);
  }
};

export const deleteLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId, linkId } = req.params;
    await LinksStation.deleteLink(gamingCenterId, linkId);
    res.noContent();
  } catch (error) {
    next(error);
  }
};
