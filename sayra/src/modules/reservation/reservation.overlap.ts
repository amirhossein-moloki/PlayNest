import { validateOperatingHours, validateLeadTime, validateStationAvailability } from './reservation.validation';

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
