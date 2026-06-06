import { ReservationStatus } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export class ReservationStateMachine {
  private static transitions: Record<ReservationStatus, ReservationStatus[]> = {
    [ReservationStatus.PENDING]: [
      ReservationStatus.CONFIRMED,
      ReservationStatus.CANCELED
    ],
    [ReservationStatus.CONFIRMED]: [
      ReservationStatus.IN_PROGRESS,
      ReservationStatus.COMPLETED,
      ReservationStatus.CANCELED,
      ReservationStatus.NO_SHOW
    ],
    [ReservationStatus.IN_PROGRESS]: [
      ReservationStatus.COMPLETED
    ],
    [ReservationStatus.COMPLETED]: [],
    [ReservationStatus.CANCELED]: [],
    [ReservationStatus.NO_SHOW]: []
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
}
