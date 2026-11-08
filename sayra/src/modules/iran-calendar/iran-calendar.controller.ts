import { Request, Response } from 'express';
import { iranCalendarService } from './iran-calendar.service';
import httpStatus from 'http-status';

export class IranCalendarController {
  static async getDays(req: Request, res: Response): Promise<void> {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;
      const includeEvents = req.query.includeEvents as unknown as boolean;
      const includeHolidays = req.query.includeHolidays as unknown as boolean;

      const result = await iranCalendarService.getDays({
        from,
        to,
        includeEvents,
        includeHolidays,
      });

      res.status(httpStatus.OK).json(result);
    } catch (error: unknown) {
      const err = error as { message?: string };
      if (err?.message === 'INVALID_FROM_DATE' || err?.message === 'INVALID_TO_DATE') {
        res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Jalali date',
          errors: {
            date: 'The provided date is not a valid Jalali date',
          },
        });
        return;
      }

      if (err?.message === 'FROM_GREATER_THAN_TO') {
        res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid date range',
          errors: {
            range: 'The start date (from) must be before or equal to the end date (to)',
          },
        });
        return;
      }

      if (err?.message === 'RANGE_EXCEEDS_MAX_LIMIT') {
        res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Date range exceeds maximum limit of 3 years',
          errors: {
            range: 'The requested range cannot exceed 3 years',
          },
        });
        return;
      }

      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Internal server error while retrieving Iranian calendar days',
      });
    }
  }
}
