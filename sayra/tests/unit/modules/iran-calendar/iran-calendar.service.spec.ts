import { IranCalendarService } from '../../../../src/modules/iran-calendar/iran-calendar.service';
import { IranCalendarRepo } from '../../../../src/modules/iran-calendar/iran-calendar.repo';

describe('IranCalendarService Unit Tests', () => {
  let service: IranCalendarService;
  let mockRepo: jest.Mocked<IranCalendarRepo>;

  beforeEach(() => {
    mockRepo = {
      findEventsByDateRange: jest.fn().mockResolvedValue([]),
      findYears: jest.fn().mockResolvedValue([]),
      importYearData: jest.fn(),
    } as unknown as jest.Mocked<IranCalendarRepo>;

    service = new IranCalendarService(mockRepo);
  });

  // 1. تبدیل تاریخ شمسی به میلادی و بالعکس
  it('1. should convert Jalali date to Gregorian and vice versa correctly', () => {
    // 1405-01-01 -> 2026-03-21
    const gregorian = service.toGregorian(1405, 1, 1);
    expect(gregorian).toEqual({ gy: 2026, gm: 3, gd: 21 });

    const jalali = service.toJalaali(2026, 3, 21);
    expect(jalali).toEqual({ jy: 1405, jm: 1, jd: 1 });

    // 1403-12-30 -> 2025-03-20
    const leapGregorian = service.toGregorian(1403, 12, 30);
    expect(leapGregorian).toEqual({ gy: 2025, gm: 3, gd: 20 });

    const leapJalali = service.toJalaali(2025, 3, 20);
    expect(leapJalali).toEqual({ jy: 1403, jm: 12, jd: 30 });
  });

  // 2. تشخیص سال کبیسه
  it('2. should correctly identify leap and non-leap Jalali years', () => {
    expect(service.isLeapYear(1403)).toBe(true);
    expect(service.isLeapYear(1404)).toBe(false);
    expect(service.isLeapYear(1405)).toBe(false);
    expect(service.isLeapYear(1406)).toBe(false);
    expect(service.isLeapYear(1407)).toBe(false);
    expect(service.isLeapYear(1408)).toBe(true);
  });

  // 3. محاسبه روز هفته (0 = شنبه, ..., 6 = جمعه)
  it('3. should calculate Iranian day of week accurately starting from Saturday=0 to Friday=6', () => {
    // 1405-01-01 is Saturday (0)
    expect(service.getDayOfWeek(1405, 1, 1)).toBe(0);
    // 1405-01-02 is Sunday (1)
    expect(service.getDayOfWeek(1405, 1, 2)).toBe(1);
    // 1405-01-03 is Monday (2)
    expect(service.getDayOfWeek(1405, 1, 3)).toBe(2);
    // 1405-01-04 is Tuesday (3)
    expect(service.getDayOfWeek(1405, 1, 4)).toBe(3);
    // 1405-01-05 is Wednesday (4)
    expect(service.getDayOfWeek(1405, 1, 5)).toBe(4);
    // 1405-01-06 is Thursday (5)
    expect(service.getDayOfWeek(1405, 1, 6)).toBe(5);
    // 1405-01-07 is Friday (6)
    expect(service.getDayOfWeek(1405, 1, 7)).toBe(6);
  });

  // 4. محاسبه شماره روز سال
  it('4. should calculate day of year correctly', () => {
    expect(service.getDayOfYear(1405, 1, 1)).toBe(1);
    expect(service.getDayOfYear(1405, 1, 31)).toBe(31);
    // Month 2 day 1: 31 + 1 = 32
    expect(service.getDayOfYear(1405, 2, 1)).toBe(32);
    // Month 7 day 1: 6 * 31 + 1 = 187
    expect(service.getDayOfYear(1405, 7, 1)).toBe(187);
    // Normal year 1405 end of year: 6*31 + 5*30 + 29 = 365
    expect(service.getDayOfYear(1405, 12, 29)).toBe(365);
    // Leap year 1403 end of year: 6*31 + 5*30 + 30 = 366
    expect(service.getDayOfYear(1403, 12, 30)).toBe(366);
  });

  // 5. محاسبه تعداد روزهای ماه
  it('5. should calculate the correct number of days in each Jalali month', () => {
    // Months 1 to 6 have 31 days
    for (let m = 1; m <= 6; m++) {
      expect(service.getJalaaliMonthLength(1405, m)).toBe(31);
    }
    // Months 7 to 11 have 30 days
    for (let m = 7; m <= 11; m++) {
      expect(service.getJalaaliMonthLength(1405, m)).toBe(30);
    }
    // Month 12: 29 days in normal year, 30 days in leap year
    expect(service.getJalaaliMonthLength(1405, 12)).toBe(29);
    expect(service.getJalaaliMonthLength(1403, 12)).toBe(30);
  });

  // 6. دریافت یک روز مشخص
  it('6. should return data for a single specific day', async () => {
    const res = await service.getDays({
      from: '1405-01-01',
      to: '1405-01-01',
    });

    expect(res.calendar).toBe('iranian');
    expect(res.totalDays).toBe(1);
    expect(res.days).toHaveLength(1);

    const day = res.days[0];
    expect(day.date).toBe('1405-01-01');
    expect(day.year).toBe(1405);
    expect(day.month).toBe(1);
    expect(day.monthName).toBe('فروردین');
    expect(day.day).toBe(1);
    expect(day.dayOfWeek).toBe(0);
    expect(day.dayOfWeekName).toBe('شنبه');
    expect(day.dayOfYear).toBe(1);
    expect(day.isWeekend).toBe(false);
  });

  // 7. دریافت یک ماه کامل
  it('7. should return all days for a full month (Farvardin = 31 days)', async () => {
    const res = await service.getDays({
      from: '1405-01-01',
      to: '1405-01-31',
    });

    expect(res.totalDays).toBe(31);
    expect(res.days).toHaveLength(31);
    expect(res.days[0].date).toBe('1405-01-01');
    expect(res.days[30].date).toBe('1405-01-31');
  });

  // 8. دریافت یک سال کامل
  it('8. should return all 365 days for a non-leap year (1405)', async () => {
    const res = await service.getDays({
      from: '1405-01-01',
      to: '1405-12-29',
    });

    expect(res.totalDays).toBe(365);
    expect(res.days).toHaveLength(365);
    expect(res.days[0].dayOfYear).toBe(1);
    expect(res.days[364].dayOfYear).toBe(365);
  });

  // 9. دریافت بازه دو ساله
  it('9. should return all days across a 2-year range', async () => {
    // 1404 (365) + 1405 (365) = 730 days
    const res = await service.getDays({
      from: '1404-01-01',
      to: '1405-12-29',
    });

    expect(res.totalDays).toBe(730);
    expect(res.days).toHaveLength(730);
  });

  // 10. بررسی تعطیلات رسمی
  it('10. should correctly identify official holidays vs weekend holidays', async () => {
    mockRepo.findEventsByDateRange.mockResolvedValue([
      {
        id: 'evt-1',
        yearId: 'y-1',
        date: '1405-01-01',
        title: 'عید نوروز',
        type: 'national',
        isHoliday: true,
        source: 'official_calendar',
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await service.getDays({
      from: '1405-01-01',
      to: '1405-01-07',
    });

    // Day 1 (Saturday): official holiday
    expect(res.days[0].date).toBe('1405-01-01');
    expect(res.days[0].isWeekend).toBe(false);
    expect(res.days[0].isHoliday).toBe(true);
    expect(res.days[0].holidayType).toBe('official');

    // Day 5 (Wednesday): normal day
    expect(res.days[4].date).toBe('1405-01-05');
    expect(res.days[4].isWeekend).toBe(false);
    expect(res.days[4].isHoliday).toBe(false);
    expect(res.days[4].holidayType).toBe('none');

    // Day 6 (Thursday): normal weekday, not automatically holiday
    expect(res.days[5].date).toBe('1405-01-06');
    expect(res.days[5].isWeekend).toBe(false);
    expect(res.days[5].isHoliday).toBe(false);
    expect(res.days[5].holidayType).toBe('none');

    // Day 7 (Friday): weekend holiday
    expect(res.days[6].date).toBe('1405-01-07');
    expect(res.days[6].isWeekend).toBe(true);
    expect(res.days[6].isHoliday).toBe(true);
    expect(res.days[6].holidayType).toBe('weekend');
  });

  // 11. بررسی مناسبت‌های چندگانه
  it('11. should handle multiple events on the same day', async () => {
    mockRepo.findEventsByDateRange.mockResolvedValue([
      {
        id: 'evt-1',
        yearId: 'y-1',
        date: '1405-01-01',
        title: 'عید نوروز',
        type: 'national',
        isHoliday: true,
        source: 'official_calendar',
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'evt-2',
        yearId: 'y-1',
        date: '1405-01-01',
        title: 'روز جهانی شعر',
        type: 'international',
        isHoliday: false,
        source: 'official_calendar',
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await service.getDays({
      from: '1405-01-01',
      to: '1405-01-01',
      includeEvents: true,
    });

    expect(res.days[0].events).toHaveLength(2);
    expect(res.days[0].events![0].title).toBe('عید نوروز');
    expect(res.days[0].events![1].title).toBe('روز جهانی شعر');
    expect(res.days[0].isHoliday).toBe(true);
    expect(res.days[0].holidayType).toBe('official');
  });

  // 12. اعتبارسنجی تاریخ نامعتبر
  it('12. should reject invalid Jalali dates', async () => {
    // Month 13
    await expect(service.getDays({ from: '1405-13-01', to: '1405-13-10' })).rejects.toThrow('INVALID_FROM_DATE');

    // Mehr (Month 7) day 31
    await expect(service.getDays({ from: '1405-07-31', to: '1405-08-01' })).rejects.toThrow('INVALID_FROM_DATE');

    // Esfand 30 in non-leap year (1405)
    await expect(service.getDays({ from: '1405-12-30', to: '1405-12-30' })).rejects.toThrow('INVALID_FROM_DATE');

    // Day 0
    await expect(service.getDays({ from: '1405-01-00', to: '1405-01-05' })).rejects.toThrow('INVALID_FROM_DATE');
  });

  // 13. بررسی بازه نامعتبر (from > to)
  it('13. should reject invalid date range where from > to', async () => {
    await expect(
      service.getDays({
        from: '1405-01-10',
        to: '1405-01-05',
      })
    ).rejects.toThrow('FROM_GREATER_THAN_TO');
  });

  // 14. بررسی بازه بیشتر از سه سال
  it('14. should reject requests exceeding 3 years (1098 days)', async () => {
    await expect(
      service.getDays({
        from: '1400-01-01',
        to: '1404-01-01', // 4 full years
      })
    ).rejects.toThrow('RANGE_EXCEEDS_MAX_LIMIT');
  });

  // 15. بررسی روزهای بدون مناسبت
  it('15. should handle days without events properly', async () => {
    mockRepo.findEventsByDateRange.mockResolvedValue([]);

    const res = await service.getDays({
      from: '1405-02-15',
      to: '1405-02-15',
      includeEvents: true,
      includeHolidays: true,
    });

    expect(res.days[0].events).toEqual([]);
    expect(res.days[0].holidayType).toBe('none');
    expect(res.days[0].isHoliday).toBe(false);
    expect(res.days[0].isWeekend).toBe(false);
  });

  // Section 13: Relative Date Support (Asia/Tehran midnight)
  describe('Relative Date Support (Asia/Tehran midnight)', () => {
    it('should correctly mark today, tomorrow, and day after tomorrow in Asia/Tehran timezone', async () => {
      // Simulate Tehran time: 2026-03-21T01:00:00Z (which is 1405-01-01 in Tehran)
      const mockNow = new Date('2026-03-21T01:00:00Z');

      const res = await service.getDays({
        from: '1405-01-01',
        to: '1405-01-04',
        currentDate: mockNow,
      });

      expect(res.days[0].date).toBe('1405-01-01');
      expect(res.days[0].isToday).toBe(true);
      expect(res.days[0].relativeDay).toBe('today');
      expect(res.days[0].relativeDayName).toBe('امروز');

      expect(res.days[1].date).toBe('1405-01-02');
      expect(res.days[1].isToday).toBe(false);
      expect(res.days[1].relativeDay).toBe('tomorrow');
      expect(res.days[1].relativeDayName).toBe('فردا');

      expect(res.days[2].date).toBe('1405-01-03');
      expect(res.days[2].isToday).toBe(false);
      expect(res.days[2].relativeDay).toBe('day_after_tomorrow');
      expect(res.days[2].relativeDayName).toBe('پس‌فردا');

      expect(res.days[3].date).toBe('1405-01-04');
      expect(res.days[3].isToday).toBe(false);
      expect(res.days[3].relativeDay).toBeNull();
      expect(res.days[3].relativeDayName).toBeNull();
    });

    it('should rollover day at Tehran midnight (20:30 UTC)', () => {
      // 2026-03-20T20:29:00Z is 23:59 Tehran time -> still 1404-12-29
      const beforeMidnight = new Date('2026-03-20T20:29:00Z');
      const todayBefore = service.getTodayJalali(beforeMidnight);
      expect(todayBefore.dateStr).toBe('1404-12-29');

      // 2026-03-20T20:31:00Z is 00:01 Tehran time -> rolled over to 1405-01-01
      const afterMidnight = new Date('2026-03-20T20:31:00Z');
      const todayAfter = service.getTodayJalali(afterMidnight);
      expect(todayAfter.dateStr).toBe('1405-01-01');
    });

    it('should not mark any day as today or tomorrow when range does not include current date', async () => {
      // Current date is 1405-01-01
      const mockNow = new Date('2026-03-21T01:00:00Z');

      const res = await service.getDays({
        from: '1405-02-01',
        to: '1405-02-10',
        currentDate: mockNow,
      });

      for (const day of res.days) {
        expect(day.isToday).toBe(false);
        expect(day.relativeDay).toBeNull();
        expect(day.relativeDayName).toBeNull();
      }
    });
  });
});
