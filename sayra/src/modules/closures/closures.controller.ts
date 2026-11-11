import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { closuresStation } from './closures.station';

export const getClosures = async (req: AppRequest, res: Response) => {
  const gamingCenterId = req.params.gamingCenterId || req.tenant?.gamingCenterId;
  const result = await closuresStation.getClosures(gamingCenterId, req.query as { startDate?: string; endDate?: string });
  res.ok(result);
};

export const createClosure = async (req: AppRequest, res: Response) => {
  const gamingCenterId = req.params.gamingCenterId || req.tenant?.gamingCenterId;
  const result = await closuresStation.createClosure(
    gamingCenterId,
    req.body,
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.created(result);
};

export const deleteClosure = async (req: AppRequest, res: Response) => {
  const gamingCenterId = req.params.gamingCenterId || req.tenant?.gamingCenterId;
  const { closureId } = req.params;
  const result = await closuresStation.deleteClosure(
    gamingCenterId,
    closureId,
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(result);
};

export const getPublicClosures = async (req: AppRequest, res: Response) => {
  const { gamingCenterSlug } = req.params;
  const result = await closuresStation.getPublicClosures(gamingCenterSlug, req.query as { startDate?: string; endDate?: string });
  res.ok(result);
};
