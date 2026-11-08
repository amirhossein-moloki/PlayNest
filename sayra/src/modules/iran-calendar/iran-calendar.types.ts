export type CalendarEventType =
  | 'national'
  | 'religious'
  | 'historical'
  | 'cultural'
  | 'international';

export type HolidayType = 'official' | 'weekend' | 'none';

export type RelativeDay = 'today' | 'tomorrow' | 'day_after_tomorrow' | null;
export type RelativeDayName = 'امروز' | 'فردا' | 'پس‌فردا' | null;

export interface CalendarEventItem {
  id?: string;
  title: string;
  type: CalendarEventType | string;
  isHoliday?: boolean;
  source?: string;
  verified?: boolean;
}

export interface DayResponse {
  date: string; // YYYY-MM-DD
  year: number;
  month: number;
  monthName: string;
  day: number;
  dayOfWeek: number; // 0 = شنبه, ..., 6 = جمعه
  dayOfWeekName: string;
  dayOfYear: number;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayType: HolidayType;
  isToday: boolean;
  relativeDay: RelativeDay;
  relativeDayName: RelativeDayName;
  events?: CalendarEventItem[];
  isOfficialCalendarPublished?: boolean;
}

export interface IranCalendarDaysResponse {
  calendar: 'iranian';
  from: string;
  to: string;
  totalDays: number;
  days: DayResponse[];
}

export interface GetIranCalendarDaysQuery {
  from: string;
  to: string;
  includeEvents?: boolean;
  includeHolidays?: boolean;
  currentDate?: Date; // Optional override for testing
}

export interface CalendarImportYearData {
  year: number;
  isOfficialCalendarPublished: boolean;
  source?: string;
  events: Array<{
    date: string;
    title: string;
    type: CalendarEventType | string;
    isHoliday: boolean;
    source?: string;
    verified?: boolean;
  }>;
}
