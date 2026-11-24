import { Request, Response } from 'express';
import logger from '../../config/logger';
import {
  buildSortedCacheKey,
  setPublicCacheHeaders,
  withPublicCache,
} from '../../common/utils/publicCache';
import { searchCatalogGames } from './gameIndex.service';
import { SearchService } from './search.service';
import {
  searchGameCentersQuerySchema,
  searchGamesQuerySchema,
  suggestQuerySchema,
} from './search.validators';

export const SearchController = {
  async searchGameCenters(req: Request, res: Response) {
    const startMs = Date.now();
    const query = searchGameCentersQuerySchema.parse(req.query);

    const cacheKey = buildSortedCacheKey('public:search:gamecenters', {
      q: query.queryText?.toLowerCase(),
      game: query.game?.toLowerCase(),
      gameId: query.gameId,
      gameSlug: query.gameSlug,
      gameIds: query.gameIds?.join(','),
      playMode: query.playMode,
      city: query.city?.toLowerCase(),
      province: query.province?.toLowerCase(),
      neighborhood: query.neighborhood?.toLowerCase(),
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm,
      deviceTypes: query.deviceTypes?.slice().sort().join(','),
      amenities: query.amenities?.slice().sort().join(','),
      hasFoodService: query.hasFoodService,
      isVip: query.isVip,
      allowOnlineBooking: query.allowOnlineBooking,
      hasDiscount: query.hasDiscount,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      minRating: query.minRating,
      minStationCount: query.minStationCount,
      isOpen: query.isOpen,
      availableNow: query.availableNow,
      availableAt: query.availableAt,
      date: query.date,
      startTime: query.startTime,
      durationHours: query.durationHours,
      minAvailableStations: query.minAvailableStations,
      sort: query.sort,
      includeFacets: query.includeFacets,
      page: query.page,
      limit: query.limit,
    });

    const isTimeSensitive = Boolean(query.availableNow || query.isOpen !== undefined || query.date);
    const ttlSeconds = isTimeSensitive ? 20 : 60;

    const result = await withPublicCache(cacheKey, ttlSeconds, () =>
      SearchService.searchGameCenters(query)
    );

    logger.info({
      msg: 'public.search.gamecenters',
      durationMs: Date.now() - startMs,
      total: result.meta.total,
      q: query.queryText ?? null,
      game: query.game ?? query.gameId ?? query.gameSlug ?? null,
      city: query.city ?? null,
    });

    setPublicCacheHeaders(res, isTimeSensitive ? 15 : 45, isTimeSensitive ? 30 : 90, 180);
    res.ok(result);
  },

  async suggest(req: Request, res: Response) {
    const query = suggestQuerySchema.parse(req.query);
    const cacheKey = buildSortedCacheKey('public:search:suggest', {
      q: query.q.toLowerCase(),
      city: query.city?.toLowerCase(),
      limit: query.limit,
    });

    const result = await withPublicCache(cacheKey, 60, () =>
      SearchService.getAutocompleteSuggestions(query)
    );

    setPublicCacheHeaders(res, 45, 90, 180);
    res.ok(result);
  },

  async searchGames(req: Request, res: Response) {
    const query = searchGamesQuerySchema.parse(req.query);
    const cacheKey = buildSortedCacheKey('public:search:games', {
      q: query.q?.toLowerCase(),
      platform: query.platform,
      category: query.category,
      supportsOnline: query.supportsOnline,
      page: query.page,
      limit: query.limit,
    });

    const result = await withPublicCache(cacheKey, 120, () =>
      searchCatalogGames(query)
    );

    setPublicCacheHeaders(res, 90, 180, 300);
    res.ok(result);
  },
};
