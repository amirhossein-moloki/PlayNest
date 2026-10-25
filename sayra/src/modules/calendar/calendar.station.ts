import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { CalendarRepo } from './calendar.repo';
import { GetCalendarQueryInput } from './calendar.dto';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { getPaginationParams, formatPaginatedResult } from '../../common/utils/pagination';

/**
 * Resolves local date inputs into exact UTC boundary dates based on the site's configured timezone.
 */
export function resolveCalendarRangeBoundaries(
  dateFromStr: string,
  dateToStr: string,
  timeZone: string
): { rangeStartUtc: Date; rangeEndUtc: Date; rangeStartLocal: string; rangeEndLocal: string } {
  let rangeStartUtc: Date;
  let rangeEndUtc: Date;

  // Check if string is simple YYYY-MM-DD date format
  const isPlainDateFrom = /^\d{4}-\d{2}-\d{2}$/.test(dateFromStr.trim());
  const isPlainDateTo = /^\d{4}-\d{2}-\d{2}$/.test(dateToStr.trim());

  if (isPlainDateFrom) {
    rangeStartUtc = fromZonedTime(`${dateFromStr.trim()} 00:00:00`, timeZone);
  } else {
    rangeStartUtc = new Date(dateFromStr);
  }

  if (isPlainDateTo) {
    rangeEndUtc = fromZonedTime(`${dateToStr.trim()} 23:59:59.999`, timeZone);
  } else {
    rangeEndUtc = new Date(dateToStr);
  }

  if (isNaN(rangeStartUtc.getTime()) || isNaN(rangeEndUtc.getTime())) {
    throw new AppError('Invalid calendar date range parameters.', httpStatus.BAD_REQUEST);
  }

  if (rangeEndUtc < rangeStartUtc) {
    throw new AppError('dateTo must be equal to or after dateFrom.', httpStatus.BAD_REQUEST);
  }

  const rangeStartLocal = formatInTimeZone(rangeStartUtc, timeZone, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
  const rangeEndLocal = formatInTimeZone(rangeEndUtc, timeZone, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");

  return { rangeStartUtc, rangeEndUtc, rangeStartLocal, rangeEndLocal };
}

export const CalendarStation = {
  async getAdminCalendar(gamingCenterId: string, query: GetCalendarQueryInput) {
    const center = await CalendarRepo.findGamingCenterWithSettings(gamingCenterId);
    if (!center) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }

    const timeZone = center.settings?.timeZone || 'UTC';

    const { rangeStartUtc, rangeEndUtc, rangeStartLocal, rangeEndLocal } = resolveCalendarRangeBoundaries(
      query.dateFrom,
      query.dateTo,
      timeZone
    );

    const { page = 1, pageSize = 100 } = query;
    const { skip, take } = getPaginationParams(page, pageSize);

    const filter = {
      gamingCenterId,
      rangeStartUtc,
      rangeEndUtc,
      status: query.status,
      stationId: query.stationId,
      staffId: query.staffId,
      customerAccountId: query.customerAccountId,
      skip,
      take,
    };

    const [reservationsData, totalReservationsCount, maintenancesData, stationsData] = await Promise.all([
      CalendarRepo.findCalendarReservations(filter),
      CalendarRepo.countCalendarReservations(filter),
      CalendarRepo.findCalendarMaintenances(gamingCenterId, rangeStartUtc, rangeEndUtc, query.stationId),
      CalendarRepo.findCalendarStations(gamingCenterId, query.stationId),
    ]);

    // Format reservations with site timezone details
    const formattedReservations = reservationsData.map((res) => ({
      id: res.id,
      gamingCenterId: res.gamingCenterId,
      stationId: res.stationId,
      stationName: res.station?.name || null,
      stationType: res.station?.stationType || null,
      isVipStation: res.station?.isVip || false,
      customerAccountId: res.customerAccountId,
      customerName: res.customerAccount?.fullName || res.customerProfile?.displayName || 'Guest',
      customerPhone: res.customerAccount?.phone || null,
      staffId: res.staffId,
      staffName: res.staff?.fullName || null,
      status: res.status,
      paymentState: res.paymentState,
      totalHours: res.totalHours,
      totalPrice: res.totalPrice,
      discountAmount: res.discountAmount,
      groupBookingId: res.groupBookingId,
      startTimeUtc: res.startTime.toISOString(),
      endTimeUtc: res.endTime.toISOString(),
      startTimeLocal: formatInTimeZone(res.startTime, timeZone, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"),
      endTimeLocal: formatInTimeZone(res.endTime, timeZone, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"),
      note: res.note,
      createdAt: res.createdAt.toISOString(),
    }));

    // Format maintenance records
    const formattedMaintenances = maintenancesData.map((m) => ({
      id: m.id,
      stationId: m.stationId,
      stationName: m.station?.name || null,
      stationType: m.station?.stationType || null,
      reason: m.reason,
      cost: m.cost,
      startTimeUtc: m.startTime.toISOString(),
      endTimeUtc: m.endTime ? m.endTime.toISOString() : null,
      startTimeLocal: formatInTimeZone(m.startTime, timeZone, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"),
      endTimeLocal: m.endTime ? formatInTimeZone(m.endTime, timeZone, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX") : null,
      createdAt: m.createdAt.toISOString(),
    }));

    const paginatedReservations = formatPaginatedResult(
      formattedReservations,
      totalReservationsCount,
      page,
      pageSize
    );

    return {
      site: {
        id: center.id,
        name: center.name,
        slug: center.slug,
        timeZone,
      },
      range: {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        rangeStartUtc: rangeStartUtc.toISOString(),
        rangeEndUtc: rangeEndUtc.toISOString(),
        rangeStartLocal,
        rangeEndLocal,
      },
      workstations: stationsData,
      maintenances: formattedMaintenances,
      reservations: paginatedReservations,
    };
  },
};
