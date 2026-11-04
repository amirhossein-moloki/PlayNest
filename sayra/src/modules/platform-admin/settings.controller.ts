import { Response, NextFunction } from 'express';
import { AppRequest } from '../../types/express';
import { updatePlatformSettingsSchema } from './settings.validators';
import { PlatformSettingsStation } from './settings.station';

export const PlatformSettingsController = {
  async getSettings(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const data = await PlatformSettingsStation.getSettingsWithInfrastructure();
      res.ok(data);
    } catch (err) {
      next(err);
    }
  },

  async updateSettings(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const validated = updatePlatformSettingsSchema.parse(req).body;
      const result = await PlatformSettingsStation.updateSettings(
        validated,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },
};
