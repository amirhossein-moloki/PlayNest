import { GamingSessionStatus } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export class GamingSessionStateMachine {
  private static transitions: Record<GamingSessionStatus, GamingSessionStatus[]> = {
    [GamingSessionStatus.ACTIVE]: [
      GamingSessionStatus.PAUSED,
      GamingSessionStatus.COMPLETED,
      GamingSessionStatus.INTERRUPTED,
    ],
    [GamingSessionStatus.PAUSED]: [
      GamingSessionStatus.ACTIVE,
      GamingSessionStatus.COMPLETED,
    ],
    [GamingSessionStatus.COMPLETED]: [],
    [GamingSessionStatus.INTERRUPTED]: [
      GamingSessionStatus.ACTIVE,
      GamingSessionStatus.COMPLETED,
    ],
    [GamingSessionStatus.NO_SHOW]: [],
  };

  static validateTransition(current: GamingSessionStatus, next: GamingSessionStatus): void {
    if (current === next) return;

    const allowed = this.transitions[current];
    if (!allowed || !allowed.includes(next)) {
      throw new AppError(
        `Invalid gaming session state transition from ${current} to ${next}`,
        httpStatus.CONFLICT,
        { code: 'INVALID_TRANSITION' }
      );
    }
  }
}
