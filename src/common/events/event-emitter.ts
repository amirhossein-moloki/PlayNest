import { EventEmitter } from 'events';

export const eventEmitter = new EventEmitter();

export enum AppEvents {
  BOOKING_CREATED = 'reservation.created',
  BOOKING_UPDATED = 'reservation.updated',
  BOOKING_CONFIRMED = 'reservation.confirmed',
  BOOKING_CANCELED = 'reservation.canceled',
  BOOKING_COMPLETED = 'reservation.completed',
  BOOKING_NOSHOW = 'reservation.noshow',
  PAYMENT_SUCCESS = 'payment.success',
  REVIEW_CREATED = 'rating.created',
}
