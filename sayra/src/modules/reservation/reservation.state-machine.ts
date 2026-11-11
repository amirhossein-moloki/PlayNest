import { ReservationStatus } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export class ReservationStateMachine {
  private static transitions: Record<ReservationStatus, ReservationStatus[]> = {
    [ReservationStatus.PENDING]: [
      ReservationStatus.CONFIRMED,
      ReservationStatus.CANCELED,
      ReservationStatus.EXPIRED,
    ],
    [ReservationStatus.EXPIRED]: [],
    [ReservationStatus.CONFIRMED]: [
      ReservationStatus.IN_PROGRESS,
      ReservationStatus.COMPLETED,
      ReservationStatus.CANCELED,
      ReservationStatus.NO_SHOW,
    ],
    [ReservationStatus.IN_PROGRESS]: [
      ReservationStatus.COMPLETED,
      ReservationStatus.CANCELED,
    ],
    [ReservationStatus.COMPLETED]: [],
    [ReservationStatus.CANCELED]: [],
    [ReservationStatus.NO_SHOW]: [],
  };

  static validateTransition(current: ReservationStatus, next: ReservationStatus): void {
    if (current === next) return;

    const allowed = this.transitions[current];
    if (!allowed || !allowed.includes(next)) {
      throw new AppError(
        `Invalid state transition from ${current} to ${next}`,
        httpStatus.CONFLICT,
        { code: 'INVALID_TRANSITION' }
      );
    }
  }

  static canTransition(current: ReservationStatus, next: ReservationStatus): boolean {
    if (current === next) return true;
    const allowed = this.transitions[current];
    return !!(allowed && allowed.includes(next));
  }

  static isTerminalState(status: ReservationStatus): boolean {
    const terminalStates: ReservationStatus[] = [
      ReservationStatus.COMPLETED,
      ReservationStatus.CANCELED,
      ReservationStatus.NO_SHOW,
      ReservationStatus.EXPIRED,
    ];
    return terminalStates.includes(status);
  }

  /**
   * Validates if a reservation can be canceled by customer prior to gaming center owner confirmation.
   * Only reservations in PENDING status can be canceled through this customer pre-confirmation flow.
   */
  static validateCustomerPreConfirmationCancellation(status: ReservationStatus): void {
    if (status === ReservationStatus.CANCELED) {
      // Idempotent case - allowed to be handled cleanly
      return;
    }
    if (status === ReservationStatus.CONFIRMED) {
      throw new AppError(
        'Reservation has already been confirmed by the gaming center and cannot be canceled via pre-confirmation flow',
        httpStatus.CONFLICT,
        { code: 'RESERVATION_ALREADY_CONFIRMED' }
      );
    }
    if (status !== ReservationStatus.PENDING) {
      throw new AppError(
        `Only pending reservations can be canceled before confirmation. Current status: ${status}`,
        httpStatus.CONFLICT,
        { code: 'INVALID_TRANSITION' }
      );
    }
  }

  static canCustomerCancelBeforeConfirmation(status: ReservationStatus): boolean {
    return status === ReservationStatus.PENDING;
  }
}
