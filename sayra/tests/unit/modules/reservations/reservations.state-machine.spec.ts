import { describe, it, expect } from '@jest/globals';
import { ReservationStateMachine } from '../../../../src/modules/reservation/reservation.state-machine';
import { ReservationStatus } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';

describe('ReservationStateMachine Unit Tests', () => {
  describe('validateTransition', () => {
    it('should allow valid transitions', () => {
      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.PENDING, ReservationStatus.CONFIRMED)
      ).not.toThrow();

      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.PENDING, ReservationStatus.CANCELED)
      ).not.toThrow();

      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.PENDING, ReservationStatus.EXPIRED)
      ).not.toThrow();

      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.CONFIRMED, ReservationStatus.IN_PROGRESS)
      ).not.toThrow();

      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED)
      ).not.toThrow();

      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.CONFIRMED, ReservationStatus.CANCELED)
      ).not.toThrow();

      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.CONFIRMED, ReservationStatus.NO_SHOW)
      ).not.toThrow();

      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.IN_PROGRESS, ReservationStatus.COMPLETED)
      ).not.toThrow();

      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.IN_PROGRESS, ReservationStatus.CANCELED)
      ).not.toThrow();
    });

    it('should allow same-state transition (idempotent)', () => {
      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.CONFIRMED, ReservationStatus.CONFIRMED)
      ).not.toThrow();

      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.CANCELED, ReservationStatus.CANCELED)
      ).not.toThrow();
    });

    it('should reject prohibited transitions', () => {
      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.COMPLETED, ReservationStatus.IN_PROGRESS)
      ).toThrow(AppError);

      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.CANCELED, ReservationStatus.CONFIRMED)
      ).toThrow(AppError);

      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.EXPIRED, ReservationStatus.CONFIRMED)
      ).toThrow(AppError);

      expect(() =>
        ReservationStateMachine.validateTransition(ReservationStatus.NO_SHOW, ReservationStatus.CONFIRMED)
      ).toThrow(AppError);
    });
  });

  describe('canTransition', () => {
    it('should return true for valid transitions and false for invalid transitions', () => {
      expect(ReservationStateMachine.canTransition(ReservationStatus.PENDING, ReservationStatus.CONFIRMED)).toBe(true);
      expect(ReservationStateMachine.canTransition(ReservationStatus.COMPLETED, ReservationStatus.CONFIRMED)).toBe(false);
      expect(ReservationStateMachine.canTransition(ReservationStatus.EXPIRED, ReservationStatus.CONFIRMED)).toBe(false);
    });
  });

  describe('isTerminalState', () => {
    it('should identify terminal states correctly', () => {
      expect(ReservationStateMachine.isTerminalState(ReservationStatus.COMPLETED)).toBe(true);
      expect(ReservationStateMachine.isTerminalState(ReservationStatus.CANCELED)).toBe(true);
      expect(ReservationStateMachine.isTerminalState(ReservationStatus.NO_SHOW)).toBe(true);
      expect(ReservationStateMachine.isTerminalState(ReservationStatus.EXPIRED)).toBe(true);

      expect(ReservationStateMachine.isTerminalState(ReservationStatus.PENDING)).toBe(false);
      expect(ReservationStateMachine.isTerminalState(ReservationStatus.CONFIRMED)).toBe(false);
      expect(ReservationStateMachine.isTerminalState(ReservationStatus.IN_PROGRESS)).toBe(false);
    });
  });
});
