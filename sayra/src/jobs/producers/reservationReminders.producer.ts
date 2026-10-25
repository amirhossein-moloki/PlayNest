import { remindersQueue } from '../queues';
import { getRequestContext } from '../../common/context/request-context';

export interface ReservationReminderJobData {
  reservationId: string;
  gamingCenterId: string;
  scheduledAt: string;
  correlationId?: string;
}

export const queueReservationReminder = async (data: ReservationReminderJobData) => {
  const context = getRequestContext();
  await remindersQueue.add('send-reservation-reminder', {
    ...data,
    correlationId: context.correlationId,
  });
};
