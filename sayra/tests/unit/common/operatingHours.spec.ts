import {
  evaluateCenterOpenStatus,
  isIntervalWithinOperatingHours,
} from '../../../src/common/utils/operatingHours';

describe('operatingHours utility', () => {
  it('evaluates standard daytime schedules accurately in Asia/Tehran', () => {
    // 2026-06-15 is a Monday (dayOfWeek = 1); Tehran is UTC+03:30
    const noonTehran = new Date('2026-06-15T08:30:00.000Z'); // 12:00 Asia/Tehran
    const lateNightTehran = new Date('2026-06-15T20:30:00.000Z'); // 00:00 Asia/Tehran next day

    const openStatus = evaluateCenterOpenStatus({
      openingTime: '10:00',
      closingTime: '23:00',
      timezone: 'Asia/Tehran',
      now: noonTehran,
    });
    expect(openStatus.isOpenNow).toBe(true);
    expect(openStatus.isTemporarilyClosed).toBe(false);

    const closedStatus = evaluateCenterOpenStatus({
      openingTime: '10:00',
      closingTime: '23:00',
      timezone: 'Asia/Tehran',
      now: lateNightTehran,
    });
    expect(closedStatus.isOpenNow).toBe(false);
  });

  it('handles 24-hour centers and overnight shifts including post-midnight tails', () => {
    // 2026-06-15T18:30:00Z = 22:00 Tehran (Monday night, day 1)
    const nightTehran = new Date('2026-06-15T18:30:00.000Z');
    // 2026-06-15T22:00:00Z = 01:30 Tehran Tuesday morning (tail of Monday's 18:00-03:00 shift!)
    const afterMidnightTail = new Date('2026-06-15T22:00:00.000Z');
    // 2026-06-16T00:30:00Z = 04:00 Tehran Tuesday (after 03:00 close)
    const afterClose = new Date('2026-06-16T00:30:00.000Z');

    const baseInput = {
      openingTime: '18:00',
      closingTime: '03:00',
      closedDays: [2], // Closed Tuesday day, still open 00:00-03:00 from Monday shift!
      timezone: 'Asia/Tehran',
    };

    expect(evaluateCenterOpenStatus({ ...baseInput, now: nightTehran }).isOpenNow).toBe(true);
    expect(evaluateCenterOpenStatus({ ...baseInput, now: afterMidnightTail }).isOpenNow).toBe(true);
    expect(evaluateCenterOpenStatus({ ...baseInput, now: afterClose }).isOpenNow).toBe(false);

    // 24-hour shift (00:00 - 00:00)
    expect(
      evaluateCenterOpenStatus({
        openingTime: '00:00',
        closingTime: '00:00',
        timezone: 'Asia/Tehran',
        now: afterClose,
      }).isOpenNow
    ).toBe(true);
  });

  it('respects closedDays, GamingCenterSchedule per-day overrides, and GamingCenterClosure windows', () => {
    // Monday 15:00 Tehran = 2026-06-15T11:30:00Z
    const mondayAfternoon = new Date('2026-06-15T11:30:00.000Z');

    // Closed via closedDays
    const closedByDay = evaluateCenterOpenStatus({
      openingTime: '09:00',
      closingTime: '22:00',
      closedDays: [1],
      timezone: 'Asia/Tehran',
      now: mondayAfternoon,
    });
    expect(closedByDay.isOpenNow).toBe(false);
    expect(closedByDay.isClosedDay).toBe(true);

    // Per-day GamingCenterSchedule explicitly overrides closedDays & hours
    const overriddenOpen = evaluateCenterOpenStatus({
      openingTime: '09:00',
      closingTime: '22:00',
      closedDays: [1],
      schedules: [{ dayOfWeek: 1, startTime: '14:00', endTime: '20:00', isClosed: false }],
      timezone: 'Asia/Tehran',
      now: mondayAfternoon,
    });
    expect(overriddenOpen.isOpenNow).toBe(true);
    expect(overriddenOpen.openingTime).toBe('14:00');
    expect(overriddenOpen.closingTime).toBe('20:00');

    // Temporary closure overrides open schedule
    const tempClosed = evaluateCenterOpenStatus({
      openingTime: '09:00',
      closingTime: '22:00',
      closures: [
        {
          id: 'cl_1',
          startDate: new Date('2026-06-15T00:00:00.000Z'),
          endDate: new Date('2026-06-16T00:00:00.000Z'),
          title: 'تعطیلات رسمی',
          reason: 'تعمیر تجهیزات',
        },
      ],
      timezone: 'Asia/Tehran',
      now: mondayAfternoon,
    });
    expect(tempClosed.isOpenNow).toBe(false);
    expect(tempClosed.isTemporarilyClosed).toBe(true);
    expect(tempClosed.activeClosure?.id).toBe('cl_1');
  });

  it('validates interval containment inside operating hours and closures', () => {
    const start = new Date('2026-06-15T12:30:00.000Z'); // 16:00 Tehran
    const end = new Date('2026-06-15T14:30:00.000Z'); // 18:00 Tehran

    expect(
      isIntervalWithinOperatingHours(start, end, {
        openingTime: '10:00',
        closingTime: '23:00',
        timezone: 'Asia/Tehran',
      })
    ).toBe(true);

    // Ends after 17:00 closingTime -> false
    expect(
      isIntervalWithinOperatingHours(start, end, {
        openingTime: '10:00',
        closingTime: '17:00',
        timezone: 'Asia/Tehran',
      })
    ).toBe(false);

    // Intersects temporary closure -> false
    expect(
      isIntervalWithinOperatingHours(start, end, {
        openingTime: '10:00',
        closingTime: '23:00',
        closures: [
          {
            id: 'cl_2',
            startDate: new Date('2026-06-15T14:00:00.000Z'),
            endDate: new Date('2026-06-15T16:00:00.000Z'),
          },
        ],
        timezone: 'Asia/Tehran',
      })
    ).toBe(false);
  });
});
