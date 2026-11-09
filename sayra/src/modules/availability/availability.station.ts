import { GetAvailabilityQuery } from './availability.validators';
import { AvailabilityRepo } from './availability.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { addDays, addMinutes } from 'date-fns';
import { format as formatTz, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { resolveValidTimeZone } from '../reservation/reservation.validation';

export interface TimeSlotItem {
  startTime: string; // ISO 8601 UTC string
  endTime: string;   // ISO 8601 UTC string
  durationMinutes: number; // 60
  stationId: string;
  isAvailable: boolean;
  staff?: {
    id: string;
    fullName: string;
  };
  unavailableReason?: 'RESERVED' | 'MAINTENANCE' | 'NO_STAFF' | 'CLOSED' | 'PAST';
}

export interface DayAvailabilitySlots {
  date: string; // YYYY-MM-DD in center's timezone
  gamingCenter: {
    id: string;
    name: string;
    slug: string;
    timeZone: string;
    isOpen: boolean;
    isCenterActive: boolean;
    operatingHours: {
      openingTime: string;
      closingTime: string;
      is24Hours: boolean;
      isClosedDay: boolean;
    };
  };
  station: {
    id: string;
    name: string;
    stationType: string;
    hourlyPrice: number;
  };
  slots: TimeSlotItem[];
}

export const SLOT_DURATION_MINUTES = 60;

/**
 * Parses "HH:mm" to minutes from 00:00.
 */
function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Computes 24-hour day boundaries for a given date in the target timezone.
 */
function getZonedDayRange(dateStr: string, timeZone: string): { start: Date; end: Date } {
  // start is dateStr 00:00:00 in timeZone
  const start = fromZonedTime(`${dateStr} 00:00:00`, timeZone);
  const end = addDays(start, 1);
  return { start, end };
}

/**
 * Determines working interval(s) for a given calendar date in target timezone.
 * Returns array of { start: Date, end: Date } in UTC.
 */
export function getWorkingIntervalsForDate(
  dateStr: string,
  rawWorkStart: string | null | undefined,
  rawWorkEnd: string | null | undefined,
  timeZone: string
): Array<{ start: Date; end: Date }> {
  const dayStart = fromZonedTime(`${dateStr} 00:00:00`, timeZone);
  const nextDayStart = addDays(dayStart, 1);

  if (!rawWorkStart || !rawWorkEnd) {
    // 24/7 operating hours
    return [{ start: dayStart, end: nextDayStart }];
  }

  const startMins = parseTimeToMinutes(rawWorkStart);
  let endMins = parseTimeToMinutes(rawWorkEnd);
  if (endMins === 0 && (rawWorkEnd === '00:00' || rawWorkEnd === '24:00')) {
    endMins = 24 * 60;
  }

  if (startMins === endMins) {
    // 24 hours open
    return [{ start: dayStart, end: nextDayStart }];
  }

  if (endMins > startMins) {
    // Normal single-day shift (e.g. 09:00 to 23:00)
    const opStart = addMinutes(dayStart, startMins);
    const opEnd = addMinutes(dayStart, endMins);
    return [{ start: opStart, end: opEnd }];
  } else {
    // Overnight shift: e.g. 18:00 to 04:00
    // Part 1: Tonight's opening from startMins until tomorrow endMins
    // For this 24-hour calendar day slice:
    // 1) From dayStart until endMins (tail of previous night's shift)
    // 2) From startMins until nextDayStart (start of tonight's shift)
    const morningPart = {
      start: dayStart,
      end: addMinutes(dayStart, endMins),
    };
    const eveningPart = {
      start: addMinutes(dayStart, startMins),
      end: nextDayStart,
    };
    return [morningPart, eveningPart];
  }
}

export const getAvailableSlots = async (
  query: GetAvailabilityQuery & { gamingCenterSlug: string }
): Promise<DayAvailabilitySlots[]> => {
  const { gamingCenterSlug, stationId, staffId, date, startDate, endDate } = query;

  // 1. Fetch GameStation and GamingCenter info
  const station = await AvailabilityRepo.findStationWithGamingCenter(stationId, gamingCenterSlug);

  if (!station) {
    throw new AppError('GameStation not found in this gamingCenter.', httpStatus.NOT_FOUND);
  }

  const gamingCenter = station.gamingCenter;
  if (!gamingCenter.isActive) {
    throw new AppError('GamingCenter is currently inactive.', httpStatus.FORBIDDEN, {
      code: 'GAMING_CENTER_INACTIVE',
    });
  }

  const timeZone = resolveValidTimeZone(gamingCenter.settings?.timeZone || gamingCenter.timezone || 'Asia/Tehran');
  const openTime = gamingCenter.settings?.workStartTime || gamingCenter.openingTime || '09:00';
  const closeTime = gamingCenter.settings?.workEndTime || gamingCenter.closingTime || '23:00';
  const closedDays = gamingCenter.closedDays || [];

  // Determine query date range
  let startZonedDate: Date;
  let endZonedDate: Date;

  if (date) {
    const { start, end } = getZonedDayRange(date, timeZone);
    startZonedDate = start;
    endZonedDate = end;
  } else if (startDate) {
    startZonedDate = new Date(startDate);
    endZonedDate = endDate ? new Date(endDate) : addDays(startZonedDate, 1);
  } else {
    const todayStr = formatTz(new Date(), 'yyyy-MM-dd', { timeZone });
    const { start, end } = getZonedDayRange(todayStr, timeZone);
    startZonedDate = start;
    endZonedDate = end;
  }

  // 2. Determine which staff members to check
  let staffToCheck = [];
  if (staffId) {
    const staff = await AvailabilityRepo.findStaff(staffId, gamingCenter.id, stationId);
    if (!staff) {
      throw new AppError('Staff member not found or does not perform this station.', httpStatus.NOT_FOUND);
    }
    staffToCheck.push(staff);
  } else {
    staffToCheck = await AvailabilityRepo.findStaffList(gamingCenter.id, stationId);
  }

  const staffIds = staffToCheck.map((s) => s.id);

  // 3. Fetch shifts, reservations, and station maintenances in query window
  const staffShifts = staffIds.length > 0 ? await AvailabilityRepo.findShifts(gamingCenter.id, staffIds) : [];
  const reservations = await AvailabilityRepo.findReservation(
    gamingCenter.id,
    stationId,
    staffIds,
    startZonedDate,
    endZonedDate
  );
  const maintenances = await AvailabilityRepo.findMaintenances(
    gamingCenter.id,
    stationId,
    startZonedDate,
    endZonedDate
  );

  // Prepare staff shift lookup: staffShiftsByDay[dayOfWeek] -> list of shifts
  const shiftsByStaffAndDay: { [key: string]: { startTime: string; endTime: string } } = {};
  for (const shift of staffShifts) {
    shiftsByStaffAndDay[`${shift.userId}-${shift.dayOfWeek}`] = {
      startTime: shift.startTime,
      endTime: shift.endTime,
    };
  }

  // 4. Generate 24-hour slices and 60-minute slots
  const daysResults: DayAvailabilitySlots[] = [];

  // Identify each unique 24-hour calendar day in the range
  const currentDayCursor = toZonedTime(startZonedDate, timeZone);

  // Ensure cursor starts at beginning of the day in local timezone
  const cursorDateStr = formatTz(currentDayCursor, 'yyyy-MM-dd', { timeZone });
  let iterDate = fromZonedTime(`${cursorDateStr} 00:00:00`, timeZone);

  while (iterDate < endZonedDate) {
    const dayStr = formatTz(iterDate, 'yyyy-MM-dd', { timeZone });
    const localDayDate = toZonedTime(iterDate, timeZone);
    const dayOfWeek = localDayDate.getDay(); // 0 = Sunday, ..., 6 = Saturday
    const isClosedDay = closedDays.includes(dayOfWeek);

    const is24h = (!openTime && !closeTime) || openTime === closeTime || (openTime === '00:00' && (closeTime === '24:00' || closeTime === '00:00'));

    const daySlots: TimeSlotItem[] = [];

    if (!isClosedDay) {
      const workingIntervals = getWorkingIntervalsForDate(dayStr, openTime, closeTime, timeZone);

      for (const interval of workingIntervals) {
        let slotStart = new Date(interval.start);

        // Generate 60-minute slots inside working interval
        while (addMinutes(slotStart, SLOT_DURATION_MINUTES) <= interval.end) {
          const slotEnd = addMinutes(slotStart, SLOT_DURATION_MINUTES);

          // Check if slot falls in the requested query range
          if (slotStart >= startZonedDate && slotEnd <= endZonedDate) {
            // Check station maintenance overlap
            const isMaintenanceConflict = maintenances.some((m) => {
              const mStart = new Date(m.startTime);
              const mEnd = m.endTime ? new Date(m.endTime) : new Date(8640000000000000);
              return slotStart < mEnd && slotEnd > mStart;
            });

            // Check reservation conflict on this station
            const isReservationConflict = reservations.some((r) => {
              const rStart = new Date(r.startTime);
              const rEnd = new Date(r.endTime);
              return slotStart < rEnd && slotEnd > rStart;
            });

            // Check staff availability for this slot
            // A staff member is available if they have a shift covering [slotStart, slotEnd]
            let assignedStaff: { id: string; fullName: string } | undefined;
            if (staffToCheck.length > 0) {
              for (const staff of staffToCheck) {
                const shift = shiftsByStaffAndDay[`${staff.id}-${dayOfWeek}`];
                if (shift) {
                  const shiftStart = fromZonedTime(`${dayStr} ${shift.startTime}:00`, timeZone);
                  const shiftEnd = fromZonedTime(`${dayStr} ${shift.endTime}:00`, timeZone);
                  if (slotStart >= shiftStart && slotEnd <= shiftEnd) {
                    assignedStaff = { id: staff.id, fullName: staff.fullName };
                    break;
                  }
                }
              }
            }

            let isAvailable = true;
            let unavailableReason: TimeSlotItem['unavailableReason'];

            if (isMaintenanceConflict) {
              isAvailable = false;
              unavailableReason = 'MAINTENANCE';
            } else if (isReservationConflict) {
              isAvailable = false;
              unavailableReason = 'RESERVED';
            } else if (staffToCheck.length > 0 && !assignedStaff) {
              // Center has staff registered, but no staff on duty for this slot
              isAvailable = false;
              unavailableReason = 'NO_STAFF';
            }

            daySlots.push({
              startTime: slotStart.toISOString(),
              endTime: slotEnd.toISOString(),
              durationMinutes: SLOT_DURATION_MINUTES,
              stationId: station.id,
              isAvailable,
              staff: assignedStaff || (staffToCheck[0] ? { id: staffToCheck[0].id, fullName: staffToCheck[0].fullName } : undefined),
              ...(unavailableReason ? { unavailableReason } : {}),
            });
          }

          slotStart = addMinutes(slotStart, SLOT_DURATION_MINUTES);
        }
      }
    }

    daysResults.push({
      date: dayStr,
      gamingCenter: {
        id: gamingCenter.id,
        name: gamingCenter.name,
        slug: gamingCenter.slug,
        timeZone,
        isOpen: !isClosedDay,
        isCenterActive: gamingCenter.isActive,
        operatingHours: {
          openingTime: openTime,
          closingTime: closeTime,
          is24Hours: is24h,
          isClosedDay,
        },
      },
      station: {
        id: station.id,
        name: station.name,
        stationType: station.stationType,
        hourlyPrice: station.hourlyPrice,
      },
      slots: daySlots,
    });

    iterDate = addDays(iterDate, 1);
  }

  return daysResults;
};
