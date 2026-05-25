import { Request, Response, NextFunction } from 'express';
import { getAvailabilityQuerySchema } from './availability.validators';
import { getAvailableSlots } from './availability.station';
import { z } from 'zod';

// We need a schema for URL params as well
const paramsSchema = z.object({
  gamingCenterSlug: z.string(),
});

export const getAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { gamingCenterSlug } = paramsSchema.parse(req.params);
    const query = getAvailabilityQuerySchema.parse(req.query);

    const slots = await getAvailableSlots({ ...query, gamingCenterSlug });

    res.ok(slots);
  } catch (error) {
    next(error); // Pass errors to the global error handler
  }
};
