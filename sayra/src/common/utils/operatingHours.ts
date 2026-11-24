import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { resolveValidTimeZone } from '../../modules/reservation/reservation.validation';
import {
  ActiveClosureSummary,
  ClosureWindowCandidate,
  resolveActiveClosureSummary,
} from '../../modules/closures/closures.validators';

export interface ScheduleRecordInput {
  dayOfWeek: number;
  startTime?: string | null;
  endTime?: string | null;
  isClosed: boolean;
}

export interface CenterOperatingHoursInput {
  openingTime?: string | null;
  closingTime?: string | null;
  closedDays?: number[] | null;
  timezone?: string | null;
  settings?: {
    workStartTime?: string | null;
    workEndTime?: string | null;
    timeZone?: string | null;
  } | null;
  schedules?: ScheduleRecordInput[] | null;
  closures?: ClosureWindowCandidate[] | null;
  now?: Date;
}

export interface CenterOpenStatusResult {
  isOpenNow: boolean;
  isTemporarilyClosed: boolean;
  closedUntil: string | null;
  activeClosure: ActiveClosureSummary | null;
  openingTime: string | null;
  closingTime: string | null;
  timezone: string;
  isClosedDay: boolean;
}

function parseMinutes(timeStr?: string | null): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 24 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

function resolveDaySchedule(
  dayOfWeek: number,
  defaultOpening: string | null,
  defaultClosing: string | null,
  closedDays: number[],
  schedules: ScheduleRecordInput[]
): {
  isClosedDay: boolean;
  openingTime: string | null;
  closingTime: string | null;
} {
  let openingTime = defaultOpening;
  let closingTime = defaultClosing;
  let isClosedDay = closedDays.includes(dayOfWeek);

  if (schedules.length > 0) {
    const daySchedule = schedules.find((s) => s.dayOfWeek === dayOfWeek);
    if (daySchedule) {
      if (daySchedule.isClosed) {
        isClosedDay = true;
      } else {
        isClosedDay = false;
        openingTime = daySchedule.startTime || openingTime;
        closingTime = daySchedule.endTime || closingTime;
      }
    }
  }

  return { isClosedDay, openingTime, closingTime };
}

/**
 * Single source of truth for evaluating whether a GamingCenter is currently open:
 * accounts for GamingCenterSchedule per day, closedDays, overnight shifts (including
 * tail hours after midnight from the previous day's shift), and active temporary closures.
 */
export function evaluateCenterOpenStatus(input: CenterOperatingHoursInput): CenterOpenStatusResult {
  const now = input.now ?? new Date();
  const rawTz = input.settings?.timeZone || input.timezone || 'Asia/Tehran';
  const timezone = resolveValidTimeZone(rawTz);

  const defaultOpening = input.settings?.workStartTime || input.openingTime || null;
  const defaultClosing = input.settings?.workEndTime || input.closingTime || null;
  const closedDays = Array.isArray(input.closedDays) ? input.closedDays : [];
  const schedules = Array.isArray(input.schedules) ? input.schedules : [];
  const closures = Array.isArray(input.closures) ? input.closures : [];

  const closureSummary = resolveActiveClosureSummary(closures, now);

  let zonedNow: Date;
  try {
    zonedNow = toZonedTime(now, timezone);
  } catch {
    zonedNow = now;
  }

  const dayOfWeek = zonedNow.getDay();
  const currentMinutes = zonedNow.getHours() * 60 + zonedNow.getMinutes();

  const today = resolveDaySchedule(dayOfWeek, defaultOpening, defaultClosing, closedDays, schedules);

  if (closureSummary.isBookingTemporarilyClosed) {
    return {
      isOpenNow: false,
      isTemporarilyClosed: true,
      closedUntil: closureSummary.bookingClosedUntil,
      activeClosure: closureSummary.activeClosure,
      openingTime: today.openingTime,
      closingTime: today.closingTime,
      timezone,
      isClosedDay: today.isClosedDay,
    };
  }

  let openToday = false;
  if (!today.isClosedDay) {
    const openMins = parseMinutes(today.openingTime);
    let closeMins = parseMinutes(today.closingTime);
    if (closeMins === 0 && (today.closingTime === '00:00' || today.closingTime === '24:00')) {
      closeMins = 24 * 60;
    }

    if (openMins === null || closeMins === null || openMins === closeMins) {
      openToday = true;
    } else if (closeMins > openMins) {
      openToday = currentMinutes >= openMins && currentMinutes < closeMins;
    } else {
      // Overnight shift starting today (e.g., 14:00 to 02:00 next day)
      openToday = currentMinutes >= openMins;
    }
  }

  // Also check yesterday's schedule in case yesterday had an overnight shift extending past midnight
  let openFromYesterdayOvernight = false;
  if (!openToday) {
    const yesterdayDayOfWeek = (dayOfWeek + 6) % 7;
    const yesterday = resolveDaySchedule(
      yesterdayDayOfWeek,
      defaultOpening,
      defaultClosing,
      closedDays,
      schedules
    );
    if (!yesterday.isClosedDay) {
      const yOpenMins = parseMinutes(yesterday.openingTime);
      let yCloseMins = parseMinutes(yesterday.closingTime);
      if (yCloseMins === 0 && (yesterday.closingTime === '00:00' || yesterday.closingTime === '24:00')) {
        yCloseMins = 24 * 60;
      }
      if (yOpenMins !== null && yCloseMins !== null && yCloseMins < yOpenMins) {
        openFromYesterdayOvernight = currentMinutes < yCloseMins;
      }
    }
  }

  return {
    isOpenNow: openToday || openFromYesterdayOvernight,
    isTemporarilyClosed: false,
    closedUntil: null,
    activeClosure: null,
    openingTime: today.openingTime,
    closingTime: today.closingTime,
    timezone,
    isClosedDay: today.isClosedDay,
  };
}

/**
 * Pure non-throwing check determining whether a requested [startTime, endTime) interval
 * falls within a GamingCenter's operating hours and outside any temporary closures.
 */
export function isIntervalWithinOperatingHours(
  startTime: Date,
  endTime: Date,
  input: Omit<CenterOperatingHoursInput, 'now'>
): boolean {
  if (endTime <= startTime) {
    return false;
  }

  const closures = Array.isArray(input.closures) ? input.closures : [];
  for (const c of closures) {
    const cStart = new Date(c.startDate);
    const cEnd = new Date(c.endDate);
    if (startTime < cEnd && endTime > cStart) {
      return false;
    }
  }

  const rawTz = input.settings?.timeZone || input.timezone || 'Asia/Tehran';
  const timezone = resolveValidTimeZone(rawTz);
  const defaultOpening = input.settings?.workStartTime || input.openingTime || null;
  const defaultClosing = input.settings?.workEndTime || input.closingTime || null;
  const closedDays = Array.isArray(input.closedDays) ? input.closedDays : [];
  const schedules = Array.isArray(input.schedules) ? input.schedules : [];

  const zonedStart = toZonedTime(startTime, timezone);
  const startDayOfWeek = zonedStart.getDay();
  const startDayStr = formatInTimeZone(startTime, timezone, 'yyyy-MM-dd');

  const dayInfo = resolveDaySchedule(
    startDayOfWeek,
    defaultOpening,
    defaultClosing,
    closedDays,
    schedules
  );

  // Also allow intervals falling in the post-midnight tail of yesterday's overnight shift
  const yesterdayDayOfWeek = (startDayOfWeek + 6) % 7;
  const yesterdayInfo = resolveDaySchedule(
    yesterdayDayOfWeek,
    defaultOpening,
    defaultClosing,
    closedDays,
    schedules
  );

  const checkShiftContainment = (
    dayStr: string,
    openStr: string | null,
    closeStr: string | null,
    isClosedDay: boolean,
    dayOffset: number
  ): boolean => {
    if (isClosedDay) return false;
    if (!openStr || !closeStr) return true;

    const openMins = parseMinutes(openStr);
    let closeMins = parseMinutes(closeStr);
    if (closeMins === 0 && (closeStr === '00:00' || closeStr === '24:00')) {
      closeMins = 24 * 60;
    }
    if (openMins === null || closeMins === null || openMins === closeMins) {
      return true;
    }

    const baseOpStart = fromZonedTime(`${dayStr} ${openStr}:00`, timezone);
    const opStart = dayOffset === 0 ? baseOpStart : addDays(baseOpStart, dayOffset);

    if (closeMins > openMins) {
      const baseOpEnd =
        closeStr === '24:00' || closeStr === '00:00'
          ? addDays(fromZonedTime(`${dayStr} 00:00:00`, timezone), 1)
          : fromZonedTime(`${dayStr} ${closeStr}:00`, timezone);
      const opEnd = dayOffset === 0 ? baseOpEnd : addDays(baseOpEnd, dayOffset);
      return startTime >= opStart && endTime <= opEnd;
    }

    const opEnd = addDays(fromZonedTime(`${dayStr} ${closeStr}:00`, timezone), 1 + dayOffset);
    return startTime >= opStart && endTime <= opEnd;
  };

  if (
    checkShiftContainment(
      startDayStr,
      dayInfo.openingTime,
      dayInfo.closingTime,
      dayInfo.isClosedDay,
      0
    )
  ) {
    return true;
  }

  // Check yesterday's overnight shift if yesterday was overnight
  if (!yesterdayInfo.isClosedDay && yesterdayInfo.openingTime && yesterdayInfo.closingTime) {
    const yOpen = parseMinutes(yesterdayInfo.openingTime);
    const yClose = parseMinutes(yesterdayInfo.closingTime);
    if (yOpen !== null && yClose !== null && yClose < yOpen) {
      return checkShiftContainment(
        startDayStr,
        yesterdayInfo.openingTime,
        yesterdayInfo.closingTime,
        false,
        -1
      );
    }
  }

  return false;
}
