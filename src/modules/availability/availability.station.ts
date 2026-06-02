import { GetAvailabilityQuery } from './availability.validators';
import { AvailabilityRepo } from './availability.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { add, isBefore, isEqual, max, differenceInMinutes } from 'date-fns';
import { format as formatTz, toZonedTime } from 'date-fns-tz';
import { getZonedStartAndEnd } from '../../common/utils/date';

interface Interval {
  start: Date;
  end: Date;
}

type TimeSlot = {
  time: string;
  staff: {
    id: string;
    fullName: string;
  };
};

const SLOT_INTERVAL_MINUTES = 15;

export const getAvailableSlots = async (
  query: GetAvailabilityQuery & { gamingCenterSlug: string }
): Promise<TimeSlot[]> => {
  const { gamingCenterSlug, stationId, staffId, startDate, endDate } = query;

  // 1. Fetch GameStation and GamingCenter info
  const station = await AvailabilityRepo.findStationWithGamingCenter(stationId, gamingCenterSlug);

  if (!station) {
    throw new AppError('GameStation not found in this gamingCenter.', httpStatus.NOT_FOUND);
  }
  const gamingCenterId = station.gamingCenterId;
  const timeZone = station.gamingCenter.settings?.timeZone || 'UTC';

  // 2. Determine which staff members to check
  let staffToCheck = [];
  if (staffId) {
    const staff = await AvailabilityRepo.findStaff(staffId, gamingCenterId, stationId);
    if (!staff) throw new AppError('Staff member not found or does not perform this station.', httpStatus.NOT_FOUND);
    staffToCheck.push(staff);
  } else {
    staffToCheck = await AvailabilityRepo.findStaffList(gamingCenterId, stationId);
  }

  if (staffToCheck.length === 0) {
    return []; // No staff available for this station
  }

  const staffIds = staffToCheck.map(s => s.id);

  // 3. Fetch all relevant staffShifts and reservations in one go
  const staffShifts = await AvailabilityRepo.findShifts(gamingCenterId, staffIds);
  const reservations = await AvailabilityRepo.findBookings(gamingCenterId, staffIds, startDate, endDate);

  // --- Core Logic: Generate and Filter Slots ---
  const availableSlots: TimeSlot[] = [];
  const serviceDuration = station.defaultDurationHours * 60;

  // Create maps for quick lookups
  const shiftsByUserId: { [userId: string]: { [day: number]: any } } = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const staffShift of staffShifts) {
    if (!shiftsByUserId[staffShift.userId]) shiftsByUserId[staffShift.userId] = {};
    shiftsByUserId[staffShift.userId][staffShift.dayOfWeek] = staffShift;
  }

  const bookingsByStaffAndDate: { [key: string]: any[] } = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const reservation of reservations) {
    const dateKey = formatTz(reservation.startTime, 'yyyy-MM-dd', { timeZone });
    const key = `${reservation.staffId}-${dateKey}`;
    if (!bookingsByStaffAndDate[key]) bookingsByStaffAndDate[key] = [];
    bookingsByStaffAndDate[key].push(reservation);
  }

  for (const staff of staffToCheck) {
    for (let day = new Date(startDate); isBefore(day, endDate) || isEqual(day, endDate); day = add(day, { days: 1 })) {
      const dayOfWeek = toZonedTime(day, timeZone).getDay();
      const staffShifts = shiftsByUserId[staff.id];
      const staffShift = staffShifts ? staffShifts[dayOfWeek] : null;

      if (!staffShift) continue; // No staffShift for this day

      const dateKey = formatTz(day, 'yyyy-MM-dd', { timeZone });
      const staffBookings = bookingsByStaffAndDate[`${staff.id}-${dateKey}`] || [];

      const daySlots = internal_calculateStaffSlotsForDay(
        staff,
        staffShift,
        day,
        timeZone,
        staffBookings,
        serviceDuration
      );

      availableSlots.push(...daySlots);
    }
  }

  return availableSlots;
};

/**
 * Core logic for calculating available slots for a single staff member on a specific day.
 * Extracted for easier unit testing.
 */
export const internal_calculateStaffSlotsForDay = (
  staff: { id: string; fullName: string },
  staffShift: { startTime: string; endTime: string },
  day: Date,
  timeZone: string,
  staffBookings: { startTime: Date; endTime: Date }[],
  serviceDuration: number
): TimeSlot[] => {
  const availableSlots: TimeSlot[] = [];
  const shiftStart = getZonedStartAndEnd(staffShift.startTime, day, timeZone);
  const shiftEnd = getZonedStartAndEnd(staffShift.endTime, day, timeZone);

  // --- Interval Arithmetic Logic ---

  // 1. Identify Gaps (Free Time)
  const sortedBookings = staffBookings
    .map((b) => ({ start: new Date(b.startTime), end: new Date(b.endTime) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const gaps: Interval[] = [];
  let currentStart = new Date(shiftStart);

  for (const reservation of sortedBookings) {
    if (isBefore(currentStart, reservation.start)) {
      gaps.push({ start: new Date(currentStart), end: new Date(reservation.start) });
    }
    currentStart = max([currentStart, reservation.end]);
    if (!isBefore(currentStart, shiftEnd)) break;
  }

  if (isBefore(currentStart, shiftEnd)) {
    gaps.push({ start: new Date(currentStart), end: new Date(shiftEnd) });
  }

  // 2. Generate Slots from Gaps
  for (const gap of gaps) {
    // Align the first potential slot in this gap to the staffShift's grid (every 15 mins from shiftStart)
    const diffToShiftStart = differenceInMinutes(gap.start, shiftStart);
    const alignedStart =
      diffToShiftStart <= 0
        ? new Date(shiftStart)
        : add(shiftStart, {
          minutes: Math.ceil(diffToShiftStart / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES,
        });

    for (
      let slotStart = new Date(alignedStart);
      add(slotStart, { minutes: serviceDuration }) <= gap.end;
      slotStart = add(slotStart, { minutes: SLOT_INTERVAL_MINUTES })
    ) {
      availableSlots.push({
        time: slotStart.toISOString(),
        staff: {
          id: staff.id,
          fullName: staff.fullName,
        },
      });
    }
  }

  return availableSlots;
};
