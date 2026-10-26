import { ReservationProposalStatus, UserRole, SessionActorType } from '@prisma/client';
import { ReservationRepo } from './reservation.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { auditService } from '../audit/audit.station';
import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import { ReservationStateMachine } from './reservation.state-machine';
import { validateLeadTime, validateOperatingHours, validateStationAvailability } from './reservation.validation';
import { ProposeTimeInput } from './reservation.dto';

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

    if (actor.role === UserRole.STAFF && reservation.staffId && reservation.staffId !== actor.id) {
      throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
    }

    if (ReservationStateMachine.isTerminalState(reservation.status)) {
      throw new AppError('Cannot propose time for a reservation in terminal state', httpStatus.CONFLICT, {
        code: 'INVALID_TRANSITION',
      });
    }

    const proposedStartTime = new Date(data.startTime);
    const proposedEndTime = new Date(data.endTime);

    const gamingCenter = await ReservationRepo.findGamingCenterWithSettings(gamingCenterId);
    const settings = gamingCenter?.settings;
    validateLeadTime(proposedStartTime, settings?.minAdvanceBookingMinutes ?? 30);

    const station = await ReservationRepo.findStation(reservation.stationId, gamingCenterId);
    const maintenances = await ReservationRepo.findOverlappingMaintenance(reservation.stationId, proposedStartTime, proposedEndTime);
    if (station) {
      validateStationAvailability(station, maintenances);
    }

    validateOperatingHours(
      proposedStartTime,
      proposedEndTime,
      settings?.workStartTime || gamingCenter?.openingTime,
      settings?.workEndTime || gamingCenter?.closingTime,
      settings?.timeZone
    );

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
    actor: { id: string; role: UserRole }
  ) {
    const reservation = await findAndValidateReservation(reservationId, gamingCenterId);

    if (actor.role === UserRole.STAFF && reservation.staffId !== actor.id) {
      throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
    }

    return ReservationRepo.listProposalsByReservationId(reservationId);
  },
};
