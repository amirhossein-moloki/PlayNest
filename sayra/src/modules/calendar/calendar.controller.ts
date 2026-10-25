import { Response, NextFunction } from 'express';
import { CalendarStation } from './calendar.station';
import { AppRequest } from '../../types/express';
import { GetCalendarQueryInput } from './calendar.dto';

export async function getAdminCalendar(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId } = req.params;
    const query = req.query as unknown as GetCalendarQueryInput;

    const calendarData = await CalendarStation.getAdminCalendar(gamingCenterId, query);
    res.ok(calendarData);
  } catch (error) {
    next(error);
  }
}
