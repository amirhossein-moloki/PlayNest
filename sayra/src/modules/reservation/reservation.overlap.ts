import { validateOperatingHours, validateLeadTime, validateStationAvailability } from './reservation.validation';
/**
 * Utility functions for reservation interval overlap detection.
 * Enforces half-open interval comparison semantics: [StartTimeUtc, EndTimeUtc)
 */

export interface TimeInterval {
  startTime: Date;
  endTime: Date;
}

/**
 * Utility function to check if two time intervals overlap.
 */
export const doIntervalsOverlap = (a: TimeInterval, b: TimeInterval): boolean => {
  return a.startTime < b.endTime && a.endTime > b.startTime;
};

export { validateOperatingHours, validateLeadTime, validateStationAvailability };
 * Checks whether two time intervals overlap using half-open intervals [start, end).
 * Two intervals overlap if: existingStart < requestedEnd AND existingEnd > requestedStart
 * Adjacent intervals (where one ends exactly when the other starts) do NOT overlap.
 */
export function isIntervalOverlapping(a: TimeInterval, b: TimeInterval): boolean {
  const startA = new Date(a.startTime).getTime();
  const endA = new Date(a.endTime).getTime();
  const startB = new Date(b.startTime).getTime();
  const endB = new Date(b.endTime).getTime();

  if (isNaN(startA) || isNaN(endA) || isNaN(startB) || isNaN(endB)) {
    return false;
  }

  return startA < endB && endA > startB;
}

/**
 * Validates that a time interval has valid start and end times, with start strictly before end.
 */
export function isValidInterval(interval: TimeInterval): boolean {
  const start = new Date(interval.startTime).getTime();
  const end = new Date(interval.endTime).getTime();

  if (isNaN(start) || isNaN(end)) {
    return false;
  }

  return start < end;
}
