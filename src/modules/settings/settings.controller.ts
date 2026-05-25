import { Request, Response, NextFunction } from 'express';
import * as settingsService from './settings.station';

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId } = req.params;
    const settings = await settingsService.getSettings(gamingCenterId);
    res.ok(settings);
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId } = req.params;
    const settings = await settingsService.updateSettings(
      gamingCenterId,
      req.body,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.ok(settings);
  } catch (error) {
    next(error);
  }
}
