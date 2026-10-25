import { addMinutes, addDays, isBefore } from 'date-fns';
import { format as formatTz, fromZonedTime } from 'date-fns-tz';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { getZonedStartAndEnd } from '../../common/utils/date';

/**
 * Validates whether a requested reservation start time meets the minimum advance booking lead time.
 */
export const validateLeadTime = (
  startTime: Date,
  minLeadTimeMinutes: number = 30,
  now: Date = new Date()
): void => {
  const minAllowedTime = addMinutes(now, minLeadTimeMinutes);
  if (isBefore(startTime, minAllowedTime)) {
    throw new AppError(
      `Reservation must be booked at least ${minLeadTimeMinutes} minutes in advance.`,
      httpStatus.BAD_REQUEST,
      { code: 'LEAD_TIME_TOO_SHORT' }
    );
  }
};

/**
 * Validates whether the requested timezone string is valid.
 * Falls back to 'UTC' if invalid.
 */
export const resolveValidTimeZone = (timeZone?: string | null): string => {
  if (!timeZone) return 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
};

/**
 * Validates that a reservation interval falls strictly within the site's operating hours.
 */
export const validateOperatingHours = (
  startTime: Date,
  endTime: Date,
  rawWorkStart?: string | null,
  rawWorkEnd?: string | null,
  rawTimeZone?: string | null
): void => {
  if (!rawWorkStart || !rawWorkEnd) {
    return; // Operating 24/7 if no explicit operating hours set
  }

  const timeZone = resolveValidTimeZone(rawTimeZone);
  const startDayStr = formatTz(startTime, 'yyyy-MM-dd', { timeZone });

  const parseMins = (str: string) => {
    const [h, m] = str.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const startMins = parseMins(rawWorkStart);
  let endMins = parseMins(rawWorkEnd);
  if (endMins === 0 && rawWorkEnd === '00:00') {
    endMins = 24 * 60;
  }

  const opStartToday = fromZonedTime(`${startDayStr} ${rawWorkStart}:00`, timeZone);

  if (endMins > startMins) {
    // Same-day operating shift (e.g. 09:00 to 23:00)
    const opEndToday = rawWorkEnd === '24:00' || rawWorkEnd === '00:00'
      ? addDays(fromZonedTime(`${startDayStr} 00:00:00`, timeZone), 1)
      : fromZonedTime(`${startDayStr} ${rawWorkEnd}:00`, timeZone);

    const isContainedToday = startTime >= opStartToday && endTime <= opEndToday;
    if (!isContainedToday) {
      throw new AppError('Selected time is outside center operating hours.', httpStatus.CONFLICT, {
        code: 'CENTER_CLOSED',
      });
    }
  } else {
    // Overnight / day-crossing shift (e.g. 18:00 to 02:00 next day)
    const opEndToday = addDays(fromZonedTime(`${startDayStr} ${rawWorkEnd}:00`, timeZone), 1);

    const opStartPrev = addDays(opStartToday, -1);
    const opEndPrev = addDays(opEndToday, -1);

    const isContainedToday = startTime >= opStartToday && endTime <= opEndToday;
    const isContainedPrev = startTime >= opStartPrev && endTime <= opEndPrev;

    if (!isContainedToday && !isContainedPrev) {
      throw new AppError('Selected time is outside center operating hours.', httpStatus.CONFLICT, {
        code: 'CENTER_CLOSED',
      });
    }
  }
};

/**
 * Validates station active status and absence of overlapping maintenance windows.
 */
export const validateStationAvailability = (
  station: { id: string; name: string; isActive?: boolean } | null,
  maintenances?: { id: string; startTime: Date; endTime: Date | null; reason: string }[] | null
): void => {
  if (!station || station.isActive === false) {
    throw new AppError('GameStation not found or is not active.', httpStatus.NOT_FOUND, {
      code: 'STATION_INACTIVE',
    });
  }

  const safeMaintenances = maintenances || [];
  if (safeMaintenances.length > 0) {
    throw new AppError('Station is under maintenance during the requested time.', httpStatus.CONFLICT, {
      code: 'STATION_UNDER_MAINTENANCE',
    });
  }
};

/**
 * Validates staff shift coverage for a reservation.
 */
export const validateStaffShiftHours = (
  staffShift: { startTime: string; endTime: string } | null,
  startTime: Date,
  endTime: Date,
  timeZone: string
): void => {
  if (!staffShift || !staffShift.startTime || !staffShift.endTime) {
    throw new AppError('Selected time is not available.', httpStatus.CONFLICT, {
      code: 'SLOT_NOT_AVAILABLE',
    });
  }

  const shiftStart = getZonedStartAndEnd(staffShift.startTime, startTime, timeZone);
  const shiftEnd = getZonedStartAndEnd(staffShift.endTime, startTime, timeZone);

  if (startTime.getTime() < shiftStart.getTime() || endTime.getTime() > shiftEnd.getTime()) {
    throw new AppError('Selected time is not available.', httpStatus.CONFLICT, {
      code: 'SLOT_NOT_AVAILABLE',
    });
  }
};
