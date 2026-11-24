import { Request, Response, NextFunction } from 'express';
import { gamingCenterStation } from './gamingCenter.station';
import { PublicGamingCentersRepo } from '../public/gamingCenters.public.repo';
import {
  buildSortedCacheKey,
  invalidateAllPublicDiscoveryCaches,
  setPublicCacheHeaders,
  withPublicCache,
} from '../../common/utils/publicCache';
import {
  createGamingCenterSchema,
  updateGamingCenterSchema,
  listGamingCentersSchema,
  getGamingCenterDetailsSchema,
  mapGamingCentersQuerySchema,
} from './gamingCenter.validation';

export const gamingCenterController = {
  async createGamingCenter(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = createGamingCenterSchema.parse(req.body);
      const gamingCenter = await gamingCenterStation.createGamingCenter(
        validatedData,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.created(gamingCenter);
      void invalidateAllPublicDiscoveryCaches();
    } catch (error) {
      next(error);
    }
  },

  async getGamingCenterById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validatedQuery = getGamingCenterDetailsSchema.parse(req.query);
      const cacheKey = buildSortedCacheKey(`public:gc:detail:${id}`, {
        include: validatedQuery.include?.join(','),
        fields: validatedQuery.fields?.join(','),
      });
      const gamingCenter = await withPublicCache(cacheKey, 60, () =>
        gamingCenterStation.getGamingCenterById(id, validatedQuery)
      );
      setPublicCacheHeaders(res, 60, 120, 300);
      res.ok(gamingCenter);
    } catch (error) {
      next(error);
    }
  },

  async getAllGamingCenters(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedQuery = listGamingCentersSchema.parse(req.query);
      const cacheKey = buildSortedCacheKey(
        'public:gc:list',
        validatedQuery as unknown as Record<string, unknown>
      );
      const gamingCenters = await withPublicCache(cacheKey, 60, () =>
        gamingCenterStation.getAllGamingCenters(validatedQuery)
      );
      setPublicCacheHeaders(res, 60, 120, 300);
      res.ok(gamingCenters);
    } catch (error) {
      next(error);
    }
  },

  async getMapGamingCenters(req: Request, res: Response, next: NextFunction) {
    try {
      const { city } = mapGamingCentersQuerySchema.parse(req.query);
      const cacheKey = `public:gc:map:${city.trim().toLowerCase()}`;
      const markers = await withPublicCache(cacheKey, 120, () =>
        PublicGamingCentersRepo.findMapGamingCentersByCity(city)
      );
      setPublicCacheHeaders(res, 120, 300, 600);
      res.ok(markers);
    } catch (error) {
      next(error);
    }
  },

  async updateGamingCenter(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validatedData = updateGamingCenterSchema.parse(req.body);
      const updatedGamingCenter = await gamingCenterStation.updateGamingCenter(
        id,
        validatedData,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      void invalidateAllPublicDiscoveryCaches();
      res.ok(updatedGamingCenter);
    } catch (error) {
      next(error);
    }
  },

  async deleteGamingCenter(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await gamingCenterStation.deleteGamingCenter(
        id,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      void invalidateAllPublicDiscoveryCaches();
      res.noContent();
    } catch (error) {
      next(error);
    }
  },
};
