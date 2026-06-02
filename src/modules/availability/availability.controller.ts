import { Request, Response, NextFunction } from 'express';
import { GetAvailabilityQuery } from './availability.validators';
import { getAvailableSlots } from './availability.station';

export const getAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { gamingCenterSlug } = req.params;
    const query = req.query as unknown as GetAvailabilityQuery;

    const slots = await getAvailableSlots({ ...query, gamingCenterSlug });

    res.ok(slots);
  } catch (error) {
    next(error); // Pass errors to the global error handler
  }
};
