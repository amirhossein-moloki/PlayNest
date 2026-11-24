import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { closuresStation } from './closures.station';
import { GetClosuresQuery } from './closures.validators';
import { invalidatePublicCacheByPrefix } from '../../common/utils/publicCache';
import { recordGamingCenterChangeEvent } from '../integrations/outbox.service';

function emitClosureChange(gamingCenterId?: string) {
  void invalidatePublicCacheByPrefix(`public:avail:${gamingCenterId}:`);
  if (gamingCenterId) {
    void recordGamingCenterChangeEvent({
      gamingCenterId,
      eventType: 'GAMING_CENTER_UPDATED',
      changedFields: ['closures', 'activityStatus'],
    });
    return;
  }
  void invalidatePublicCacheByPrefix('public:gc:');
  void invalidatePublicCacheByPrefix('public:gamecenters:');
}

export const getClosures = async (req: AppRequest, res: Response) => {
  const gamingCenterId = req.params.gamingCenterId || req.tenant?.gamingCenterId;
  const result = await closuresStation.getClosures(gamingCenterId, req.query as GetClosuresQuery);
  res.ok(result);
};

export const getActiveClosureStatus = async (req: AppRequest, res: Response) => {
  const gamingCenterId = req.params.gamingCenterId || req.tenant?.gamingCenterId;
  const result = await closuresStation.getActiveClosureStatus(gamingCenterId);
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
  emitClosureChange(gamingCenterId);
  res.created(result);
};

export const closeForNextHours = async (req: AppRequest, res: Response) => {
  const gamingCenterId = req.params.gamingCenterId || req.tenant?.gamingCenterId;
  const result = await closuresStation.closeForNextHours(
    gamingCenterId,
    req.body,
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  emitClosureChange(gamingCenterId);
  res.created(result);
};

export const reopenBookings = async (req: AppRequest, res: Response) => {
  const gamingCenterId = req.params.gamingCenterId || req.tenant?.gamingCenterId;
  const result = await closuresStation.reopenBookings(
    gamingCenterId,
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  emitClosureChange(gamingCenterId);
  res.ok(result);
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
  emitClosureChange(gamingCenterId);
  res.ok(result);
};

export const getPublicClosures = async (req: AppRequest, res: Response) => {
  const { gamingCenterSlug } = req.params;
  const result = await closuresStation.getPublicClosures(gamingCenterSlug, req.query as GetClosuresQuery);
  res.ok(result);
};

export const getPublicActiveClosureStatus = async (req: AppRequest, res: Response) => {
  const { gamingCenterSlug } = req.params;
  const result = await closuresStation.getPublicActiveClosureStatus(gamingCenterSlug);
  res.ok(result);
};
