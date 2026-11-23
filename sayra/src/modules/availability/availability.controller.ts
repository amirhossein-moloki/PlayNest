import { Request, Response, NextFunction } from 'express';
import { GetAvailabilityQuery } from './availability.validators';
import { getAvailableSlots } from './availability.station';
import { buildSortedCacheKey, withPublicCache } from '../../common/utils/publicCache';

export const getAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { gamingCenterSlug } = req.params;
    const gamingCenterId = (req as { tenant?: { gamingCenterId?: string } }).tenant?.gamingCenterId;
    const query = req.query as unknown as GetAvailabilityQuery;

    const cacheKey = buildSortedCacheKey(
      `public:avail:${gamingCenterId || gamingCenterSlug}:${query.stationId}`,
      {
        date: query.date,
        startDate: query.startDate ? new Date(query.startDate).toISOString() : undefined,
        endDate: query.endDate ? new Date(query.endDate).toISOString() : undefined,
        staffId: query.staffId,
      }
    );

    const slots = await withPublicCache(cacheKey, 20, () =>
      getAvailableSlots({ ...query, gamingCenterSlug, gamingCenterId })
    );

    res.ok(slots);
  } catch (error) {
    next(error); // Pass errors to the global error handler
  }
};
