import { Request, Response, NextFunction } from 'express';
import { PublicGamingCentersRepo } from './gamingCenters.public.repo';
import { mapGamingCentersQuerySchema } from '../gamingCenter/gamingCenter.validation';

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

  /**
   * GET /public/gaming-centers/map?city=...
   */
  async getMapGamingCenters(req: Request, res: Response, next: NextFunction) {
    try {
      const { city } = mapGamingCentersQuerySchema.parse(req.query);
      const markers = await PublicGamingCentersRepo.findMapGamingCentersByCity(city);
      res.ok(markers);
    } catch (err) {
      next(err);
    }
  },
};
