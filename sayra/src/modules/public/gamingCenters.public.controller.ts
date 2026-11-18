import { Request, Response, NextFunction } from 'express';
import { PublicGamingCentersRepo } from './gamingCenters.public.repo';

export const PublicGamingCentersController = {
  /**
   * GET /public/gaming-centers/cities
   */
  async getRegisteredCities(_req: Request, res: Response, next: NextFunction) {
    try {
      const cities = await PublicGamingCentersRepo.findRegisteredCities();
      res.ok(cities);
    } catch (err) {
      next(err);
    }
  },
};
