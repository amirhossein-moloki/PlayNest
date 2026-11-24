import { Request, Response } from 'express';
import httpStatus from 'http-status';
import AppError from '../../common/errors/AppError';
import logger from '../../config/logger';
import {
  buildSortedCacheKey,
  setPublicCacheHeaders,
  withPublicCache,
} from '../../common/utils/publicCache';
import { PublicGameCentersRepo } from './public-gamecenters.repo';
import {
  listPublicGameCentersQuerySchema,
  publicGameCenterIdParamsSchema,
  rankingsQuerySchema,
} from './public-gamecenters.validation';

export const PublicGameCentersApiController = {
  async listGameCenters(req: Request, res: Response) {
    const startMs = Date.now();
    const query = listPublicGameCentersQuerySchema.parse(req.query);

    const cacheKey = buildSortedCacheKey('public:gamecenters:list', {
      ids: query.ids?.join(','),
      city: query.city?.toLowerCase(),
      neighborhood: (query.neighborhood || query.district)?.toLowerCase(),
      status: query.status,
      deviceType: query.deviceType,
      amenities: query.amenities?.slice().sort().join(','),
      search: query.search?.toLowerCase(),
      page: query.page,
      limit: query.limit,
    });

    const result = await withPublicCache(cacheKey, 120, () =>
      PublicGameCentersRepo.findMany(query)
    );

    logger.info({
      msg: 'public.gamecenters.list',
      durationMs: Date.now() - startMs,
      count: result.data.length,
      city: query.city ?? null,
      batchIdsCount: query.ids?.length ?? 0,
    });

    setPublicCacheHeaders(res, 60, 120, 300);
    res.ok(result);
  },

  async getRankings(req: Request, res: Response) {
    const startMs = Date.now();
    const query = rankingsQuerySchema.parse(req.query);

    const cacheKey = buildSortedCacheKey('public:gamecenters:rankings', {
      city: query.city?.toLowerCase(),
      neighborhood: (query.neighborhood || query.district)?.toLowerCase(),
      deviceType: query.deviceType,
      amenities: query.amenities?.slice().sort().join(','),
      limit: query.limit,
      newlyRegisteredLimit: query.newlyRegisteredLimit,
      minReviews: query.minReviews,
      m: query.m,
      sort: query.sort,
      includeNewlyRegistered: query.includeNewlyRegistered,
    });

    const rankings = await withPublicCache(cacheKey, 180, () =>
      PublicGameCentersRepo.getRankings(query)
    );

    logger.info({
      msg: 'public.gamecenters.rankings',
      durationMs: Date.now() - startMs,
      city: query.city ?? null,
      rankedCount: rankings.ranked.length,
      newlyRegisteredCount: rankings.newlyRegistered.length,
    });

    setPublicCacheHeaders(res, 120, 180, 600);
    res.ok(rankings);
  },

  async getGameCenterById(req: Request, res: Response) {
    const startMs = Date.now();
    const { id } = publicGameCenterIdParamsSchema.parse(req.params);

    const cacheKey = `public:gamecenters:detail:${id.toLowerCase()}`;
    const center = await withPublicCache(cacheKey, 120, async () =>
      PublicGameCentersRepo.findByIdOrSlug(id)
    );

    if (!center) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND, {
        code: 'GAMING_CENTER_NOT_FOUND',
      });
    }

    logger.info({
      msg: 'public.gamecenters.detail',
      durationMs: Date.now() - startMs,
      gamingCenterId: center.id,
      slug: center.slug,
    });

    setPublicCacheHeaders(res, 60, 120, 300);
    res.ok(center);
  },
};
