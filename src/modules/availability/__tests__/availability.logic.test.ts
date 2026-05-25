import { internal_calculateStaffSlotsForDay } from '../availability.station';
import { startOfDay } from 'date-fns';

describe('Availability Logic (Interval Arithmetic)', () => {
  const staff = { id: 'staff-1', fullName: 'Test Staff' };
  const timeZone = 'UTC';
  const day = startOfDay(new Date('2024-05-20T00:00:00Z')); // A Monday
  const staffShift = { startTime: '09:00:00', endTime: '17:00:00' };
  const serviceDuration = 60; // 1 hour

  it('should return all slots when there are no reservations', () => {
    const slots = internal_calculateStaffSlotsForDay(staff, staffShift, day, timeZone, [], serviceDuration);

    // 09:00 to 17:00 is 8 hours.
    // Slots at 09:00, 09:15, ..., 16:00 (since 16:00 ends at 17:00)
    // 4 slots per hour * 7 hours (from 09:00 to 16:00) + 1 (at 16:00)
    // Wait:
    // 09:00, 09:15, 09:30, 09:45 (4)
    // ...
    // 15:00, 15:15, 15:30, 15:45 (4)
    // 16:00 (1)
    // Total = 7 * 4 + 1 = 29 slots.

    expect(slots.length).toBe(29);
    expect(slots[0].time).toBe(new Date(day.getTime()).setHours(9, 0, 0, 0) && new Date(new Date(day).setHours(9,0,0,0)).toISOString());
  });

  it('should exclude slots that overlap with a reservation', () => {
    const reservations = [
      {
        startTime: new Date(new Date(day).setHours(11, 0, 0, 0)),
        endTime: new Date(new Date(day).setHours(12, 0, 0, 0)),
      },
    ];

    const slots = internal_calculateStaffSlotsForDay(staff, staffShift, day, timeZone, reservations, serviceDuration);

    // Booked 11:00-12:00.
    // GameStation duration 60m.
    // Any slot that starts before 11:00 but ends after 11:00 should be excluded.
    // Slot at 10:15 ends at 11:15 -> Excluded.
    // Slot at 10:30 ends at 11:30 -> Excluded.
    // Slot at 10:45 ends at 11:45 -> Excluded.
    // Slot at 11:00 is booked -> Excluded.
    // Slot at 11:15 overlaps -> Excluded.
    // ...
    // Slot at 11:45 overlaps -> Excluded.
    // Slot at 12:00 starts when reservation ends -> OK.

    const slotTimes = slots.map(s => s.time);

    expect(slotTimes).toContain(new Date(new Date(day).setHours(10, 0, 0, 0)).toISOString());
    expect(slotTimes).not.toContain(new Date(new Date(day).setHours(10, 15, 0, 0)).toISOString());
    expect(slotTimes).not.toContain(new Date(new Date(day).setHours(11, 0, 0, 0)).toISOString());
    expect(slotTimes).toContain(new Date(new Date(day).setHours(12, 0, 0, 0)).toISOString());
  });

  it('should handle multiple overlapping reservations correctly', () => {
    const reservations = [
      {
        startTime: new Date(new Date(day).setHours(10, 0, 0, 0)),
        endTime: new Date(new Date(day).setHours(11, 0, 0, 0)),
      },
      {
        startTime: new Date(new Date(day).setHours(10, 30, 0, 0)),
        endTime: new Date(new Date(day).setHours(11, 30, 0, 0)),
      },
    ];

    const slots = internal_calculateStaffSlotsForDay(staff, staffShift, day, timeZone, reservations, serviceDuration);
    const slotTimes = slots.map(s => s.time);

    // Total blocked: 10:00 to 11:30.
    // Slots ending after 10:00 but before 11:30 are blocked.
    // Slot 09:00 ends 10:00 -> OK.
    // Slot 09:15 ends 10:15 -> Blocked.
    // Slot 11:30 ends 12:30 -> OK.

    expect(slotTimes).toContain(new Date(new Date(day).setHours(9, 0, 0, 0)).toISOString());
    expect(slotTimes).not.toContain(new Date(new Date(day).setHours(9, 15, 0, 0)).toISOString());
    expect(slotTimes).toContain(new Date(new Date(day).setHours(11, 30, 0, 0)).toISOString());
  });

  it('should return no slots if reservations cover the entire staffShift', () => {
    const reservations = [
      {
        startTime: new Date(new Date(day).setHours(9, 0, 0, 0)),
        endTime: new Date(new Date(day).setHours(17, 0, 0, 0)),
      },
    ];

    const slots = internal_calculateStaffSlotsForDay(staff, staffShift, day, timeZone, reservations, serviceDuration);
    expect(slots.length).toBe(0);
  });

  it('should handle reservations that start before the staffShift and overlap', () => {
    const reservations = [
      {
        startTime: new Date(new Date(day).setHours(8, 0, 0, 0)),
        endTime: new Date(new Date(day).setHours(10, 0, 0, 0)),
      },
    ];

    const slots = internal_calculateStaffSlotsForDay(staff, staffShift, day, timeZone, reservations, serviceDuration);
    const slotTimes = slots.map(s => s.time);

    // StaffShift starts at 09:00. Reservation ends at 10:00.
    // Slots before 10:00 should be blocked.
    // 09:00 ends 10:00 -> should be blocked if it overlaps with 08:00-10:00.
    // Wait, the gap should be [10:00, 17:00].
    // So 09:00 is NOT in any gap.

    expect(slotTimes).not.toContain(new Date(new Date(day).setHours(9, 0, 0, 0)).toISOString());
    expect(slotTimes).toContain(new Date(new Date(day).setHours(10, 0, 0, 0)).toISOString());
  });

  it('should handle reservations that end after the staffShift and overlap', () => {
    const reservations = [
      {
        startTime: new Date(new Date(day).setHours(16, 0, 0, 0)),
        endTime: new Date(new Date(day).setHours(18, 0, 0, 0)),
      },
    ];

    const slots = internal_calculateStaffSlotsForDay(staff, staffShift, day, timeZone, reservations, serviceDuration);
    const slotTimes = slots.map(s => s.time);

    // StaffShift ends at 17:00. Reservation starts at 16:00.
    // Gap should be [09:00, 16:00].
    // Slot 15:00 ends 16:00 -> OK.
    // Slot 15:15 ends 16:15 -> NO (overlaps with 16:00-18:00).

    expect(slotTimes).toContain(new Date(new Date(day).setHours(15, 0, 0, 0)).toISOString());
    expect(slotTimes).not.toContain(new Date(new Date(day).setHours(15, 15, 0, 0)).toISOString());
    expect(slotTimes).not.toContain(new Date(new Date(day).setHours(16, 0, 0, 0)).toISOString());
  });
});
