import { ReservationProposalStatus, ReservationStatus, UserRole, SessionActorType } from '@prisma/client';
import { ReservationRepo } from './reservation.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { addMinutes } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { auditService } from '../audit/audit.station';
import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import {
  resolveValidTimeZone,
  validateLeadTime,
  validateOperatingHours,
  validateStationAvailability,
} from './reservation.validation';
import {
  DEFAULT_MIN_LEAD_TIME_MINUTES,
  getWorkingIntervalsForDate,
  SLOT_DURATION_MINUTES,
} from '../availability/availability.station';
import { ProposeTimeInput } from './reservation.dto';

const ALLOWED_PROPOSAL_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
];

const findAndValidateReservation = async (reservationId: string, gamingCenterId: string) => {
  const reservation = await ReservationRepo.findReservationById(reservationId, gamingCenterId);
  if (!reservation) {
    throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
  }
  return reservation;
};

export const reservationProposals = {
  async proposeTime(
    reservationId: string,
    gamingCenterId: string,
    createdByUserId: string,
    data: ProposeTimeInput,
    actor: { id: string; role: UserRole; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const reservation = await findAndValidateReservation(reservationId, gamingCenterId);


    if (!ALLOWED_PROPOSAL_STATUSES.includes(reservation.status)) {
      throw new AppError(
        'Time proposal is only allowed for PENDING or CONFIRMED reservations',
        httpStatus.CONFLICT,
        { code: 'INVALID_TRANSITION' }
      );
    }

    if (reservation.completedAt || (reservation.endTime && new Date(reservation.endTime) <= new Date())) {
      throw new AppError(
        'Cannot propose a new time for a reservation that has already ended.',
        httpStatus.CONFLICT,
        { code: 'RESERVATION_ALREADY_ENDED' }
      );
    }

    const gamingCenter = await ReservationRepo.findGamingCenterWithSettings(gamingCenterId);
    const settings = gamingCenter?.settings;
    const timeZone = resolveValidTimeZone(settings?.timeZone || gamingCenter?.timezone || 'UTC');

    const defaultDurationHours = reservation.totalHours && reservation.totalHours >= 1 ? reservation.totalHours : 1;
    const durationHours = data.durationHours ?? defaultDurationHours;

    let proposedStartTime: Date;
    let proposedEndTime: Date;

    if (data.date && data.slotTime) {
      proposedStartTime = fromZonedTime(`${data.date} ${data.slotTime}:00`, timeZone);
      proposedEndTime = addMinutes(proposedStartTime, durationHours * SLOT_DURATION_MINUTES);
    } else if (data.startTime) {
      proposedStartTime = new Date(data.startTime);
      proposedEndTime = data.endTime
        ? new Date(data.endTime)
        : addMinutes(proposedStartTime, durationHours * SLOT_DURATION_MINUTES);
    } else {
      throw new AppError('Either startTime or date and slotTime must be provided', httpStatus.BAD_REQUEST, {
        code: 'INVALID_TIME_SLOT',
      });
    }

    const durationMinutes = Math.round((proposedEndTime.getTime() - proposedStartTime.getTime()) / 60000);
    if (durationMinutes <= 0 || durationMinutes % SLOT_DURATION_MINUTES !== 0) {
      throw new AppError(
        `Proposed time must align with ${SLOT_DURATION_MINUTES}-minute slot duration.`,
        httpStatus.BAD_REQUEST,
        { code: 'INVALID_TIME_SLOT' }
      );
    }

    validateLeadTime(proposedStartTime, settings?.minAdvanceBookingMinutes ?? DEFAULT_MIN_LEAD_TIME_MINUTES);

    const station = await ReservationRepo.findStation(reservation.stationId, gamingCenterId);
    const maintenances = await ReservationRepo.findOverlappingMaintenance(
      reservation.stationId,
      proposedStartTime,
      proposedEndTime
    );
    if (station) {
      validateStationAvailability(station, maintenances);
    }

    validateOperatingHours(proposedStartTime, proposedEndTime, {
      openingTime: settings?.workStartTime || gamingCenter?.openingTime,
      closingTime: settings?.workEndTime || gamingCenter?.closingTime,
      timeZone,
      closedDays: gamingCenter?.closedDays,
      schedules: gamingCenter?.schedules,
      closures: gamingCenter?.closures,
    });

    // Verify proposed time aligns with the gaming center's 60-minute slot grid for that date
    const slotDateStr = formatInTimeZone(proposedStartTime, timeZone, 'yyyy-MM-dd');
    const localDayOfWeek = toZonedTime(proposedStartTime, timeZone).getDay();
    let dayOpen = settings?.workStartTime || gamingCenter?.openingTime;
    let dayClose = settings?.workEndTime || gamingCenter?.closingTime;
    const daySchedule = gamingCenter?.schedules?.find((s) => s.dayOfWeek === localDayOfWeek);
    if (daySchedule && !daySchedule.isClosed) {
      dayOpen = daySchedule.startTime || dayOpen;
      dayClose = daySchedule.endTime || dayClose;
    }

    const workingIntervals = getWorkingIntervalsForDate(slotDateStr, dayOpen, dayClose, timeZone);
    const slotDurationMs = SLOT_DURATION_MINUTES * 60 * 1000;
    const isAlignedToSlotGrid = workingIntervals.some(
      (interval) =>
        proposedStartTime >= interval.start &&
        proposedEndTime <= interval.end &&
        (proposedStartTime.getTime() - interval.start.getTime()) % slotDurationMs === 0
    );

    if (!isAlignedToSlotGrid) {
      throw new AppError(
        `Proposed time must align with the ${SLOT_DURATION_MINUTES}-minute availability slot grid.`,
        httpStatus.BAD_REQUEST,
        { code: 'INVALID_TIME_SLOT' }
      );
    }

    const overlappingReservation = await ReservationRepo.findOverlappingReservation(
      gamingCenterId,
      reservation.staffId || '',
      proposedStartTime,
      proposedEndTime,
      reservation.id,
      undefined,
      reservation.stationId
    );
    if (overlappingReservation) {
      throw new AppError('Selected time slot is not available.', httpStatus.CONFLICT, {
        code: 'SLOT_NOT_AVAILABLE',
      });
    }

    const proposal = await ReservationRepo.transaction(async (tx) => {
      // Cancel any existing PENDING proposal for this reservation
      await ReservationRepo.cancelPendingProposals(reservationId, tx);

      const created = await ReservationRepo.createTimeProposal(
        {
          reservationId,
          originalStartTime: reservation.startTime,
          originalEndTime: reservation.endTime,
          proposedStartTime,
          proposedEndTime,
          note: data.note,
          status: ReservationProposalStatus.PENDING,
          createdByUserId,
        },
        tx
      );

      await auditService.log(
        gamingCenterId,
        actor,
        'RESERVATION_TIME_PROPOSED',
        { name: 'ReservationTimeProposal', id: created.id },
        { new: created },
        context
      );

      return created;
    });

    eventEmitter.emit(AppEvents.RESERVATION_TIME_PROPOSED, {
      reservationId: reservation.id,
      customerId: reservation.customerAccountId,
      gamingCenterId: reservation.gamingCenterId,
      proposalId: proposal.id,
      proposal,
    });

    return proposal;
  },

  async getProposals(
    reservationId: string,
    gamingCenterId: string,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    actor: { id: string; role: UserRole }
  ) {
    await findAndValidateReservation(reservationId, gamingCenterId);

    return ReservationRepo.listProposalsByReservationId(reservationId);
  },
};
