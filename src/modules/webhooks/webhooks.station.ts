import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

const processPaymentWebhook = async () => {
  // Generic payment webhook processing removed as it is tied to the Reservation/Payment domain.
  // This is a placeholder for future generic webhook implementations.
  throw new AppError('Generic payment webhooks are not implemented in this boilerplate.', httpStatus.NOT_IMPLEMENTED);
};

export const WebhooksStation = {
  processPaymentWebhook,
};
