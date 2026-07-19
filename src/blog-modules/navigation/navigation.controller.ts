import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { navigationStation } from './navigation.station';
import catchAsync from '../../common/utils/catchAsync';
import { MenuLocation } from '@prisma/client';

export const navigationController = {
  createMenu: catchAsync(async (req: Request, res: Response) => {
    const actor = { id: req.actor!.id, actorType: req.actor!.actorType };
    const context = { ip: req.ip, userAgent: req.get('User-Agent') };
    const menu = await navigationStation.createMenu(
      { ...req.body, gamingCenterId: req.gamingCenterId! },
      actor,
      context
    );
    res.status(httpStatus.CREATED).send(menu);
  }),

  getMenuTree: catchAsync(async (req: Request, res: Response) => {
    const tree = await navigationStation.getMenuTree(
      req.params.location as MenuLocation,
      req.gamingCenterId!,
      req.actor as { role: import('@prisma/client').UserRole }
    );
    res.send(tree);
  }),

  addMenuItem: catchAsync(async (req: Request, res: Response) => {
    const actor = { id: req.actor!.id, actorType: req.actor!.actorType };
    const context = { ip: req.ip, userAgent: req.get('User-Agent') };
    const item = await navigationStation.addMenuItem(
      req.body,
      req.gamingCenterId!,
      actor,
      context
    );
    res.status(httpStatus.CREATED).send(item);
  }),

  updateMenuItem: catchAsync(async (req: Request, res: Response) => {
    const actor = { id: req.actor!.id, actorType: req.actor!.actorType };
    const context = { ip: req.ip, userAgent: req.get('User-Agent') };
    const item = await navigationStation.updateMenuItem(
      req.params.id,
      req.body.menuId,
      req.gamingCenterId!,
      req.body,
      actor,
      context
    );
    res.send(item);
  }),

  deleteMenuItem: catchAsync(async (req: Request, res: Response) => {
    const actor = { id: req.actor!.id, actorType: req.actor!.actorType };
    const context = { ip: req.ip, userAgent: req.get('User-Agent') };
    await navigationStation.deleteMenuItem(
      req.params.id,
      req.query.menuId as string,
      req.gamingCenterId!,
      actor,
      context
    );
    res.status(httpStatus.NO_CONTENT).send();
  }),
};
