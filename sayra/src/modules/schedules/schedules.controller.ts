import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { schedulesStation } from './schedules.station';

export const getSchedules = async (req: AppRequest, res: Response) => {
  const gamingCenterId = req.params.gamingCenterId || req.tenant?.gamingCenterId;
  const result = await schedulesStation.getSchedules(gamingCenterId);
  res.ok(result);
};

export const updateSchedules = async (req: AppRequest, res: Response) => {
  const gamingCenterId = req.params.gamingCenterId || req.tenant?.gamingCenterId;
  const { schedules } = req.body;
  const result = await schedulesStation.updateSchedules(
    gamingCenterId,
    schedules,
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(result);
};

export const getPublicSchedules = async (req: AppRequest, res: Response) => {
  const { gamingCenterSlug } = req.params;
  const result = await schedulesStation.getPublicSchedules(gamingCenterSlug);
  res.ok(result);
};
