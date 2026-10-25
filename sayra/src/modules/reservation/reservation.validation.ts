import { addMinutes, isBefore, parse } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { getZonedStartAndEnd } from '../../common/utils/date';

/**
 * Resolves a valid IANA timezone string or falls back to 'UTC'.
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
 * Validates minimum advance booking lead time.
 */
export const validateLeadTime = (
  startTime: Date,
  minAdvanceBookingMinutes: number = 30,
  now: Date = new Date()
): void => {
  if (isBefore(startTime, now)) {
    throw new AppError('Reservation start time must be in the future.', httpStatus.BAD_REQUEST, {
      code: 'RESERVATION_START_TIME_IN_PAST',
    });
  }

  const minAllowedTime = addMinutes(now, minAdvanceBookingMinutes);
  if (isBefore(startTime, minAllowedTime)) {
    throw new AppError(
      `Reservations must be booked at least ${minAdvanceBookingMinutes} minutes in advance.`,
      httpStatus.BAD_REQUEST,
      { code: 'LEAD_TIME_TOO_SHORT', details: { minAdvanceBookingMinutes } }
    );
  }
};

/**
 * Validates whether reservation window falls within the center's operating hours.
 * Handles same-day and overnight (day-crossing) operating windows.
 */
export const validateOperatingHours = (
  startTime: Date,
  endTime: Date,
  workStartTime?: string | null,
  workEndTime?: string | null,
  timeZoneInput?: string | null
): void => {
  if (!workStartTime || !workEndTime) return; // 24/7 or unspecified

  const timeZone = resolveValidTimeZone(timeZoneInput);

  const startFormatted = formatInTimeZone(startTime, timeZone, 'HH:mm');
  const endFormatted = formatInTimeZone(endTime, timeZone, 'HH:mm');

  const refDay = '2020-01-01';
  const openTime = parse(`${refDay} ${workStartTime}`, 'yyyy-MM-dd HH:mm', new Date());
  let closeTime = parse(`${refDay} ${workEndTime}`, 'yyyy-MM-dd HH:mm', new Date());

  const isOvernight = workEndTime <= workStartTime;
  if (isOvernight) {
    closeTime = addMinutes(closeTime, 24 * 60);
  }

  let reqStart = parse(`${refDay} ${startFormatted}`, 'yyyy-MM-dd HH:mm', new Date());
  let reqEnd = parse(`${refDay} ${endFormatted}`, 'yyyy-MM-dd HH:mm', new Date());

  if (isOvernight && reqStart < openTime && reqStart < parse(`${refDay} ${workEndTime}`, 'yyyy-MM-dd HH:mm', new Date())) {
    reqStart = addMinutes(reqStart, 24 * 60);
    reqEnd = addMinutes(reqEnd, 24 * 60);
  } else if (reqEnd <= reqStart) {
    reqEnd = addMinutes(reqEnd, 24 * 60);
  }

  if (reqStart < openTime || reqEnd > closeTime) {
    throw new AppError('Gaming center is closed during the requested time window.', httpStatus.CONFLICT, {
      code: 'CENTER_CLOSED',
      details: {
        workStartTime,
        workEndTime,
        timeZone,
      },
    });
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
