import { Request, Response, NextFunction } from 'express';
import * as settingsStation from './settings.station';
import { invalidatePublicCacheByPrefix } from '../../common/utils/publicCache';
import { invalidateAnalyticsTimezoneCache } from '../analytics/analytics.cache';
import { recordGamingCenterChangeEvent } from '../integrations/outbox.service';

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const gamingCenterId =
      req.params.gamingCenterId ||
      (req as any).gamingCenterId || // eslint-disable-line @typescript-eslint/no-explicit-any
      (req as any).tenant?.gamingCenterId; // eslint-disable-line @typescript-eslint/no-explicit-any

    const settings = await settingsStation.getSettings(gamingCenterId);
    res.ok(settings);
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const gamingCenterId =
      req.params.gamingCenterId ||
      (req as any).gamingCenterId || // eslint-disable-line @typescript-eslint/no-explicit-any
      (req as any).tenant?.gamingCenterId; // eslint-disable-line @typescript-eslint/no-explicit-any

    const settings = await settingsStation.updateSettings(
      gamingCenterId,
      req.body,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    if (gamingCenterId) {
      void invalidatePublicCacheByPrefix(`public:avail:${gamingCenterId}:`);
      void invalidateAnalyticsTimezoneCache(gamingCenterId);
      void recordGamingCenterChangeEvent({
        gamingCenterId,
        eventType: 'GAMING_CENTER_UPDATED',
        changedFields: ['settings', 'activityStatus'],
      });
    } else {
      void invalidatePublicCacheByPrefix('public:gc:');
      void invalidatePublicCacheByPrefix('public:gamecenters:');
    }
    res.ok(settings);
  } catch (error) {
    next(error);
  }
}
