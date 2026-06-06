import { EventEmitter } from 'events';

export const eventEmitter = new EventEmitter();

export enum AppEvents {
  RESERVATION_CREATED = 'reservation.created',
  RESERVATION_UPDATED = 'reservation.updated',
  RESERVATION_CONFIRMED = 'reservation.confirmed',
  RESERVATION_CANCELED = 'reservation.canceled',
  RESERVATION_COMPLETED = 'reservation.completed',
  RESERVATION_NOSHOW = 'reservation.noshow',
  PAYMENT_SUCCESS = 'payment.success',
  REVIEW_CREATED = 'rating.created',
}
