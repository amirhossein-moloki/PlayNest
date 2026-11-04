import { Response, NextFunction } from 'express';
import { AppRequest } from '../../types/express';
import { platformAnalyticsReportsQuerySchema } from './analytics.validators';
import { PlatformAnalyticsStation } from './analytics.station';

export const PlatformAnalyticsController = {
  async getReports(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const query = platformAnalyticsReportsQuerySchema.parse(req.query);
      const reports = await PlatformAnalyticsStation.getReports(query);
      res.ok(reports);
    } catch (err) {
      next(err);
    }
  },
};
