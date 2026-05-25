import { Router } from 'express';
import { getAvailability } from './availability.controller';

const router = Router({ mergeParams: true });

// Note: The full path will be determined by how this router is mounted.
// We expect something like /public/gamingCenters/:salonSlug/availability
router.get('/slots', getAvailability);

export default router;
