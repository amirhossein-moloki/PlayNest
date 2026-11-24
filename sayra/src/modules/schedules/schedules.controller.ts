import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { schedulesStation } from './schedules.station';
import { invalidatePublicCacheByPrefix } from '../../common/utils/publicCache';
import { recordGamingCenterChangeEvent } from '../integrations/outbox.service';

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
  void invalidatePublicCacheByPrefix(`public:avail:${gamingCenterId}:`);
  if (gamingCenterId) {
    void recordGamingCenterChangeEvent({
      gamingCenterId,
      eventType: 'GAMING_CENTER_UPDATED',
      changedFields: ['schedules', 'activityStatus'],
    });
  } else {
    void invalidatePublicCacheByPrefix('public:gc:');
    void invalidatePublicCacheByPrefix('public:gamecenters:');
  }
  res.ok(result);
};

export const getPublicSchedules = async (req: AppRequest, res: Response) => {
  const { gamingCenterSlug } = req.params;
  const result = await schedulesStation.getPublicSchedules(gamingCenterSlug);
  res.ok(result);
};
