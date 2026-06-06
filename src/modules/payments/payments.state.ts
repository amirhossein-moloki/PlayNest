import { PaymentStatus, ReservationPaymentState } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

/**
 * Defines the state machine for PaymentStatus.
 * For a given 'from' state, it returns the valid 'to' states.
 */
const paymentTransitions: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.INITIATED]: [PaymentStatus.PENDING, PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELED],
  [PaymentStatus.PENDING]: [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELED],
  [PaymentStatus.PAID]: [PaymentStatus.REFUNDED],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.CANCELED]: [],
  [PaymentStatus.REFUNDED]: [],
  [PaymentStatus.VOID]: [],
};

/**
 * Defines the state machine for ReservationPaymentState.
 */
const reservationTransitions: Record<ReservationPaymentState, ReservationPaymentState[]> = {
  [ReservationPaymentState.UNPAID]: [ReservationPaymentState.PENDING, ReservationPaymentState.PAID],
  [ReservationPaymentState.PENDING]: [ReservationPaymentState.PAID, ReservationPaymentState.FAILED, ReservationPaymentState.CANCELED],
  [ReservationPaymentState.PARTIALLY_PAID]: [ReservationPaymentState.PAID, ReservationPaymentState.REFUNDED, ReservationPaymentState.OVERPAID],
  [ReservationPaymentState.PAID]: [ReservationPaymentState.REFUNDED],
  [ReservationPaymentState.REFUNDED]: [],
  [ReservationPaymentState.OVERPAID]: [ReservationPaymentState.REFUNDED],
  [ReservationPaymentState.FAILED]: [],
  [ReservationPaymentState.CANCELED]: [],
};

/**
 * Validates a transition for the PaymentStatus.
 * @throws {AppError} if the transition is invalid.
 */
export function validatePaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  const allowedTransitions = paymentTransitions[from];
  if (!allowedTransitions || !allowedTransitions.includes(to)) {
    throw new AppError(`Invalid payment state transition from ${from} to ${to}.`, httpStatus.CONFLICT);
  }
}

/**
 * Validates a transition for the ReservationPaymentState.
 * @throws {AppError} if the transition is invalid.
 */
export function validateReservationTransition(from: ReservationPaymentState, to: ReservationPaymentState): void {
  const allowedTransitions = reservationTransitions[from];
  if (!allowedTransitions || !allowedTransitions.includes(to)) {
    throw new AppError(`Invalid reservation payment state transition from ${from} to ${to}.`, httpStatus.CONFLICT);
  }
}
