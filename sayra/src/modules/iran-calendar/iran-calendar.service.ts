import jalaali from 'jalaali-js';
import {
  CalendarEventItem,
  DayResponse,
  GetIranCalendarDaysQuery,
  HolidayType,
  IranCalendarDaysResponse,
  RelativeDay,
  RelativeDayName,
} from './iran-calendar.types';
import { IranCalendarRepo, iranCalendarRepo } from './iran-calendar.repo';

export const PERSIAN_MONTH_NAMES: Record<number, string> = {
  1: 'فروردین',
  2: 'اردیبهشت',
  3: 'خرداد',
  4: 'تیر',
  5: 'مرداد',
  6: 'شهریور',
  7: 'مهر',
  8: 'آبان',
  9: 'آذر',
  10: 'دی',
  11: 'بهمن',
  12: 'اسفند',
};

export const PERSIAN_DAY_OF_WEEK_NAMES: Record<number, string> = {
  0: 'شنبه',
  1: 'یکشنبه',
  2: 'دوشنبه',
  3: 'سه‌شنبه',
  4: 'چهارشنبه',
  5: 'پنجشنبه',
  6: 'جمعه',
};

export class IranCalendarService {
  constructor(private readonly repo: IranCalendarRepo = iranCalendarRepo) {}

  /**
   * Parse a YYYY-MM-DD date string into numbers
   */
  parseJalaliDate(dateStr: string): { year: number; month: number; day: number } | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    return { year, month, day };
  }

  /**
   * Validate if the given Jalali year, month, day represents a valid date
   */
  isValidJalaliDate(year: number, month: number, day: number): boolean {
    if (year < 1000 || year > 2500) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1) return false;

    const monthLength = this.getJalaaliMonthLength(year, month);
    return day <= monthLength;
  }

  /**
   * Returns whether the given Jalali year is a leap year
   */
  isLeapYear(year: number): boolean {
    return jalaali.isLeapJalaaliYear(year);
  }

  /**
   * Returns length of a Jalali month
   */
  getJalaaliMonthLength(year: number, month: number): number {
    return jalaali.jalaaliMonthLength(year, month);
  }

  /**
   * Converts Jalali date to Gregorian { gy, gm, gd }
   */
  toGregorian(year: number, month: number, day: number): { gy: number; gm: number; gd: number } {
    return jalaali.toGregorian(year, month, day);
  }

  /**
   * Converts Gregorian date to Jalali { jy, jm, jd }
   */
  toJalaali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
    return jalaali.toJalaali(gy, gm, gd);
  }

  /**
   * Calculates the Iranian day of week (0 = شنبه, ..., 6 = جمعه)
   */
  getDayOfWeek(year: number, month: number, day: number): number {
    const { gy, gm, gd } = this.toGregorian(year, month, day);
    const gDate = new Date(Date.UTC(gy, gm - 1, gd));
    const gDay = gDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    // Mapping:
    // Sunday (0) -> 1 (یکشنبه)
    // Monday (1) -> 2 (دوشنبه)
    // Tuesday (2) -> 3 (سه‌شنبه)
    // Wednesday (3) -> 4 (چهارشنبه)
    // Thursday (4) -> 5 (پنجشنبه)
    // Friday (5) -> 6 (جمعه)
    // Saturday (6) -> 0 (شنبه)
    return (gDay + 1) % 7;
  }

  /**
   * Calculates the day of year (1 to 365 or 366)
   */
  getDayOfYear(year: number, month: number, day: number): number {
    let dayCount = 0;
    for (let m = 1; m < month; m++) {
      dayCount += this.getJalaaliMonthLength(year, m);
    }
    dayCount += day;
    return dayCount;
  }

  /**
   * Formats numbers into YYYY-MM-DD
   */
  formatDate(year: number, month: number, day: number): string {
    const yStr = String(year).padStart(4, '0');
    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  }

  /**
   * Increments a Jalali date by 1 day
   */
  nextJalaliDay(year: number, month: number, day: number): { year: number; month: number; day: number } {
    const maxDays = this.getJalaaliMonthLength(year, month);
    if (day < maxDays) {
      return { year, month, day: day + 1 };
    }
    if (month < 12) {
      return { year, month: month + 1, day: 1 };
    }
    return { year: year + 1, month: 1, day: 1 };
  }

  /**
   * Compares two Jalali dates.
   * Returns < 0 if d1 < d2, 0 if d1 == d2, > 0 if d1 > d2
   */
  compareDates(
    d1: { year: number; month: number; day: number },
    d2: { year: number; month: number; day: number }
  ): number {
    if (d1.year !== d2.year) return d1.year - d2.year;
    if (d1.month !== d2.month) return d1.month - d2.month;
    return d1.day - d2.day;
  }

  /**
   * Computes Jalali today based on the exact Asia/Tehran timezone midnight.
   */
  getTodayJalali(date: Date = new Date()): { year: number; month: number; day: number; dateStr: string } {
    // Formatter in en-CA with timeZone Asia/Tehran gives YYYY-MM-DD in Gregorian for Tehran
    const tehranFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = tehranFormatter.formatToParts(date);
    const gy = parseInt(parts.find((p) => p.type === 'year')?.value || '2000', 10);
    const gm = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
    const gd = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);

    const { jy, jm, jd } = this.toJalaali(gy, gm, gd);
    return {
      year: jy,
      month: jm,
      day: jd,
      dateStr: this.formatDate(jy, jm, jd),
    };
  }

  /**
   * Fetch Iranian calendar days for the given range
   */
  async getDays(query: GetIranCalendarDaysQuery): Promise<IranCalendarDaysResponse> {
    const fromParts = this.parseJalaliDate(query.from);
    const toParts = this.parseJalaliDate(query.to);

    if (!fromParts || !this.isValidJalaliDate(fromParts.year, fromParts.month, fromParts.day)) {
      throw new Error('INVALID_FROM_DATE');
    }

    if (!toParts || !this.isValidJalaliDate(toParts.year, toParts.month, toParts.day)) {
      throw new Error('INVALID_TO_DATE');
    }

    if (this.compareDates(fromParts, toParts) > 0) {
      throw new Error('FROM_GREATER_THAN_TO');
    }

    const includeEvents = query.includeEvents !== false;
    const includeHolidays = query.includeHolidays !== false;

    // Relative dates calculation (Asia/Tehran midnight)
    const todayJalali = this.getTodayJalali(query.currentDate || new Date());
    const tomorrowJalali = this.nextJalaliDay(todayJalali.year, todayJalali.month, todayJalali.day);
    const dayAfterTomorrowJalali = this.nextJalaliDay(
      tomorrowJalali.year,
      tomorrowJalali.month,
      tomorrowJalali.day
    );

    const todayStr = todayJalali.dateStr;
    const tomorrowStr = this.formatDate(tomorrowJalali.year, tomorrowJalali.month, tomorrowJalali.day);
    const dayAfterTomorrowStr = this.formatDate(
      dayAfterTomorrowJalali.year,
      dayAfterTomorrowJalali.month,
      dayAfterTomorrowJalali.day
    );

    // Collect all unique years in range
    const yearsSet = new Set<number>();
    let curr = { ...fromParts };
    const dateList: Array<{ year: number; month: number; day: number; dateStr: string }> = [];

    const MAX_DAYS = 3 * 366; // 3 years max limit

    while (this.compareDates(curr, toParts) <= 0) {
      yearsSet.add(curr.year);
      dateList.push({
        year: curr.year,
        month: curr.month,
        day: curr.day,
        dateStr: this.formatDate(curr.year, curr.month, curr.day),
      });

      if (dateList.length > MAX_DAYS) {
        throw new Error('RANGE_EXCEEDS_MAX_LIMIT');
      }

      curr = this.nextJalaliDay(curr.year, curr.month, curr.day);
    }

    // Query DB for events and years metadata
    const yearsArray = Array.from(yearsSet);
    const [dbEvents, dbYears] = await Promise.all([
      this.repo.findEventsByDateRange(query.from, query.to),
      this.repo.findYears(yearsArray),
    ]);

    // Group events by date string
    const eventsByDate = new Map<string, CalendarEventItem[]>();
    for (const evt of dbEvents) {
      const items = eventsByDate.get(evt.date) || [];
      items.push({
        id: evt.id,
        title: evt.title,
        type: evt.type,
        isHoliday: evt.isHoliday,
        source: evt.source,
        verified: evt.verified,
      });
      eventsByDate.set(evt.date, items);
    }

    const yearPublishedMap = new Map<number, boolean>();
    for (const y of dbYears) {
      yearPublishedMap.set(y.year, y.isOfficialCalendarPublished);
    }

    // Generate output days
    const days: DayResponse[] = dateList.map((d) => {
      const dayOfWeek = this.getDayOfWeek(d.year, d.month, d.day);
      const isWeekend = dayOfWeek === 6; // Friday is weekend
      const monthName = PERSIAN_MONTH_NAMES[d.month] || '';
      const dayOfWeekName = PERSIAN_DAY_OF_WEEK_NAMES[dayOfWeek] || '';
      const dayOfYear = this.getDayOfYear(d.year, d.month, d.day);

      const dayEvents = eventsByDate.get(d.dateStr) || [];

      // Check official holiday events
      const hasOfficialHoliday = dayEvents.some((e) => e.isHoliday);

      let isHoliday = false;
      let holidayType: HolidayType = 'none';

      if (includeHolidays) {
        if (hasOfficialHoliday) {
          isHoliday = true;
          holidayType = 'official';
        } else if (isWeekend) {
          isHoliday = true;
          holidayType = 'weekend';
        }
      }

      // Relative day calculation
      let isToday = false;
      let relativeDay: RelativeDay = null;
      let relativeDayName: RelativeDayName = null;

      if (d.dateStr === todayStr) {
        isToday = true;
        relativeDay = 'today';
        relativeDayName = 'امروز';
      } else if (d.dateStr === tomorrowStr) {
        relativeDay = 'tomorrow';
        relativeDayName = 'فردا';
      } else if (d.dateStr === dayAfterTomorrowStr) {
        relativeDay = 'day_after_tomorrow';
        relativeDayName = 'پس‌فردا';
      }

      const dayRes: DayResponse = {
        date: d.dateStr,
        year: d.year,
        month: d.month,
        monthName,
        day: d.day,
        dayOfWeek,
        dayOfWeekName,
        dayOfYear,
        isWeekend,
        isHoliday,
        holidayType,
        isToday,
        relativeDay,
        relativeDayName,
      };

      if (yearPublishedMap.has(d.year)) {
        dayRes.isOfficialCalendarPublished = yearPublishedMap.get(d.year);
      }

      if (includeEvents) {
        dayRes.events = dayEvents.map((e) => ({
          title: e.title,
          type: e.type,
          ...(e.isHoliday !== undefined ? { isHoliday: e.isHoliday } : {}),
          ...(e.source !== undefined ? { source: e.source } : {}),
          ...(e.verified !== undefined ? { verified: e.verified } : {}),
        }));
      }

      return dayRes;
    });

    return {
      calendar: 'iranian',
      from: query.from,
      to: query.to,
      totalDays: days.length,
      days,
    };
  }
}

export const iranCalendarService = new IranCalendarService();
