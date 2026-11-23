import { Request, Response, NextFunction } from 'express';
import { PublicGamingCentersRepo } from './gamingCenters.public.repo';
import { mapGamingCentersQuerySchema } from '../gamingCenter/gamingCenter.validation';
import { setPublicCacheHeaders, withPublicCache } from '../../common/utils/publicCache';

export const PublicGamingCentersController = {
  /**
   * GET /public/gaming-centers/cities
   */
  async getRegisteredCities(_req: Request, res: Response, next: NextFunction) {
    try {
      const cities = await withPublicCache('public:gc:cities', 300, () =>
        PublicGamingCentersRepo.findRegisteredCities()
      );
      setPublicCacheHeaders(res, 300, 600, 600);
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
      const cacheKey = `public:gc:map:${city.trim().toLowerCase()}`;
      const markers = await withPublicCache(cacheKey, 120, () =>
        PublicGamingCentersRepo.findMapGamingCentersByCity(city)
      );
      setPublicCacheHeaders(res, 120, 300, 600);
      res.ok(markers);
    } catch (err) {
      next(err);
    }
  },
};
