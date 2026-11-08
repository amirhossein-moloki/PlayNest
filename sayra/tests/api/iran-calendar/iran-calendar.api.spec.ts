import request from 'supertest';
import app from '../../../src/app';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { iranCalendarRepo } from '../../../src/modules/iran-calendar/iran-calendar.repo';

jest.mock('../../../src/modules/iran-calendar/iran-calendar.repo');

describe('Iranian Calendar API (GET /api/v1/iran-calendar/days)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (iranCalendarRepo.findEventsByDateRange as jest.MockedFunction<typeof iranCalendarRepo.findEventsByDateRange>).mockResolvedValue([]);
    (iranCalendarRepo.findYears as jest.MockedFunction<typeof iranCalendarRepo.findYears>).mockResolvedValue([
      {
        id: 'year-1405',
        year: 1405,
        isOfficialCalendarPublished: true,
        source: 'official_calendar',
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  it('should return 400 when from or to parameters are missing', async () => {
    const resNoFrom = await request(app).get('/api/v1/iran-calendar/days?to=1405-01-10');
    expect(resNoFrom.status).toBe(400);
    expect(resNoFrom.body.success).toBe(false);
    expect(resNoFrom.body.errors.from).toBeDefined();

    const resNoTo = await request(app).get('/api/v1/iran-calendar/days?from=1405-01-01');
    expect(resNoTo.status).toBe(400);
    expect(resNoTo.body.success).toBe(false);
    expect(resNoTo.body.errors.to).toBeDefined();
  });

  it('should return 400 when date is invalid Jalali format or value', async () => {
    const res = await request(app).get('/api/v1/iran-calendar/days?from=1405-01-32&to=1405-02-05');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid Jalali date');
    expect(res.body.errors.from).toBe('The provided date is not a valid Jalali date');
  });

  it('should return 400 when from is greater than to', async () => {
    const res = await request(app).get('/api/v1/iran-calendar/days?from=1405-01-15&to=1405-01-10');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid date range');
    expect(res.body.errors.range).toBeDefined();
  });

  it('should return 400 when range exceeds 3 years', async () => {
    const res = await request(app).get('/api/v1/iran-calendar/days?from=1400-01-01&to=1404-01-01');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Date range exceeds maximum limit of 3 years');
    expect(res.body.errors.range).toBe('The requested range cannot exceed 3 years');
  });

  it('should successfully return Iranian calendar days with events and holidays', async () => {
    (iranCalendarRepo.findEventsByDateRange as jest.MockedFunction<typeof iranCalendarRepo.findEventsByDateRange>).mockResolvedValue([
      {
        id: 'evt-1',
        yearId: 'year-1405',
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

    const res = await request(app).get('/api/v1/iran-calendar/days?from=1405-01-01&to=1405-01-03');
    expect(res.status).toBe(200);
    expect(res.body.calendar).toBe('iranian');
    expect(res.body.from).toBe('1405-01-01');
    expect(res.body.to).toBe('1405-01-03');
    expect(res.body.totalDays).toBe(3);
    expect(res.body.days).toHaveLength(3);

    const day1 = res.body.days[0];
    expect(day1.date).toBe('1405-01-01');
    expect(day1.year).toBe(1405);
    expect(day1.month).toBe(1);
    expect(day1.monthName).toBe('فروردین');
    expect(day1.day).toBe(1);
    expect(day1.dayOfWeek).toBe(0);
    expect(day1.dayOfWeekName).toBe('شنبه');
    expect(day1.dayOfYear).toBe(1);
    expect(day1.isWeekend).toBe(false);
    expect(day1.isHoliday).toBe(true);
    expect(day1.holidayType).toBe('official');
    expect(day1.events).toHaveLength(1);
    expect(day1.events[0].title).toBe('عید نوروز');
    expect(day1.isOfficialCalendarPublished).toBe(true);
    expect(typeof day1.isToday).toBe('boolean');
  });
});
