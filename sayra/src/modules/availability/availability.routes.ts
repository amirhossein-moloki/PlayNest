import { Router } from 'express';
import { getAvailability } from './availability.controller';
import { validate } from '../../common/middleware/validate';
import { getAvailabilitySchema } from './availability.validators';
import { publicApiRateLimiter } from '../../common/middleware/rateLimit';

const router = Router({ mergeParams: true });

// Note: The full path will be determined by how this router is mounted.
// We expect something like /public/gamingCenters/:gamingCenterSlug/availability
router.get('/slots', publicApiRateLimiter, validate(getAvailabilitySchema), getAvailability);

export default router;
