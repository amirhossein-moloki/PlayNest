import { Request, Response, NextFunction } from 'express';
import { iranCalendarService } from './iran-calendar.service';
import httpStatus from 'http-status';

export interface IranCalendarValidationErrors {
  from?: string;
  to?: string;
  range?: string;
  [key: string]: string | undefined;
}

export function validateIranCalendarQuery(req: Request, res: Response, next: NextFunction) {
  const { from, to, includeEvents, includeHolidays } = req.query;

  const errors: IranCalendarValidationErrors = {};

  if (!from || typeof from !== 'string' || !from.trim()) {
    errors.from = 'The "from" query parameter is required';
  }

  if (!to || typeof to !== 'string' || !to.trim()) {
    errors.to = 'The "to" query parameter is required';
  }

  if (errors.from || errors.to) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Missing required date parameters',
      errors,
    });
  }

  const fromStr = (from as string).trim();
  const toStr = (to as string).trim();

  // Validate format and Jalali date
  const fromParts = iranCalendarService.parseJalaliDate(fromStr);
  if (!fromParts || !iranCalendarService.isValidJalaliDate(fromParts.year, fromParts.month, fromParts.day)) {
    errors.from = 'The provided date is not a valid Jalali date';
  }

  const toParts = iranCalendarService.parseJalaliDate(toStr);
  if (!toParts || !iranCalendarService.isValidJalaliDate(toParts.year, toParts.month, toParts.day)) {
    errors.to = 'The provided date is not a valid Jalali date';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Invalid Jalali date',
      errors,
    });
  }

  // Check from <= to
  if (iranCalendarService.compareDates(fromParts!, toParts!) > 0) {
    errors.range = 'The start date (from) must be before or equal to the end date (to)';
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Invalid date range',
      errors,
    });
  }

  // Check maximum range of 3 years (3 * 366 days = 1098 days)
  let curr = { ...fromParts! };
  let count = 0;
  const MAX_DAYS = 3 * 366;
  let rangeExceeded = false;

  while (iranCalendarService.compareDates(curr, toParts!) <= 0) {
    count++;
    if (count > MAX_DAYS) {
      rangeExceeded = true;
      break;
    }
    curr = iranCalendarService.nextJalaliDay(curr.year, curr.month, curr.day);
  }

  if (rangeExceeded) {
    errors.range = 'The requested range cannot exceed 3 years';
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Date range exceeds maximum limit of 3 years',
      errors,
    });
  }

  // Parse booleans with default = true
  const parsedIncludeEvents = includeEvents === undefined || (includeEvents as unknown) === 'true' || (includeEvents as unknown) === true;
  const parsedIncludeHolidays = includeHolidays === undefined || (includeHolidays as unknown) === 'true' || (includeHolidays as unknown) === true;

  req.query.from = fromStr;
  req.query.to = toStr;
  (req.query as Record<string, unknown>).includeEvents = parsedIncludeEvents;
  (req.query as Record<string, unknown>).includeHolidays = parsedIncludeHolidays;

  next();
}
