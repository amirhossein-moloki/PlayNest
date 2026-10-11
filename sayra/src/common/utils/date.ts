import { set } from 'date-fns';
import { format as formatTz, fromZonedTime } from 'date-fns-tz';

/**
 * Converts a time string (HH:mm:ss) to a Date object for a specific given day.
 * @param timeStr The time string in 'HH:mm:ss' format.
 * @param date The target date to set the time on.
 * @returns A Date object with the time set.
 */
export const timeToDate = (timeStr: string, date: Date): Date => {
  const [hours, minutes, seconds] = timeStr.split(':').map(Number);
  return set(date, { hours, minutes, seconds: seconds || 0, milliseconds: 0 });
};

/**
 * Converts a time string (HH:mm:ss) to a UTC Date object for a specific day and timezone.
 */
export const getZonedStartAndEnd = (timeStr: string, date: Date, timeZone: string): Date => {
  const datePart = formatTz(date, 'yyyy-MM-dd', { timeZone });
  const parts = timeStr.split(':');
  if (parts.length === 2 && parts[0] === '23' && parts[1] === '59') {
    return fromZonedTime(`${datePart} 23:59:59.999`, timeZone);
  }
  return fromZonedTime(`${datePart} ${timeStr}`, timeZone);
};
