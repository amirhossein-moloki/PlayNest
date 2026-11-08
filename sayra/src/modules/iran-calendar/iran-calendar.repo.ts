import { prisma } from '../../config/prisma';
import { CalendarImportYearData } from './iran-calendar.types';

export class IranCalendarRepo {
  async findEventsByDateRange(from: string, to: string) {
    return prisma.calendarEvent.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async findYears(years: number[]) {
    return prisma.calendarYear.findMany({
      where: {
        year: { in: years },
      },
    });
  }

  async importYearData(data: CalendarImportYearData) {
    return prisma.$transaction(async (tx) => {
      const calendarYear = await tx.calendarYear.upsert({
        where: { year: data.year },
        update: {
          isOfficialCalendarPublished: data.isOfficialCalendarPublished,
          source: data.source || 'official_calendar',
          lastSyncedAt: new Date(),
        },
        create: {
          year: data.year,
          isOfficialCalendarPublished: data.isOfficialCalendarPublished,
          source: data.source || 'official_calendar',
          lastSyncedAt: new Date(),
        },
      });

      for (const event of data.events) {
        await tx.calendarEvent.upsert({
          where: {
            date_title: {
              date: event.date,
              title: event.title,
            },
          },
          update: {
            yearId: calendarYear.id,
            type: event.type,
            isHoliday: event.isHoliday,
            source: event.source || data.source || 'official_calendar',
            verified: event.verified !== undefined ? event.verified : data.isOfficialCalendarPublished,
          },
          create: {
            yearId: calendarYear.id,
            date: event.date,
            title: event.title,
            type: event.type,
            isHoliday: event.isHoliday,
            source: event.source || data.source || 'official_calendar',
            verified: event.verified !== undefined ? event.verified : data.isOfficialCalendarPublished,
          },
        });
      }

      return calendarYear;
    });
  }
}

export const iranCalendarRepo = new IranCalendarRepo();
