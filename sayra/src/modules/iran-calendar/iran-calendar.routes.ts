import { Router } from 'express';
import { IranCalendarController } from './iran-calendar.controller';
import { validateIranCalendarQuery } from './iran-calendar.validators';
import { publicApiRateLimiter } from '../../common/middleware/rateLimit';

export const iranCalendarRouter = Router();

iranCalendarRouter.get('/days', publicApiRateLimiter, validateIranCalendarQuery, IranCalendarController.getDays);

export default iranCalendarRouter;
