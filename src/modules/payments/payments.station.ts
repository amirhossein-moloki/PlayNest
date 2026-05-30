import { ReservationPaymentState, PaymentProvider, PaymentStatus } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { PaymentsRepo } from './payments.repo';
import { env } from '../../config/env';

const initiatePayment = async ({
  gamingCenterId,
  reservationId,
  idempotencyKey,
}: {
  gamingCenterId: string;
  reservationId: string;
  idempotencyKey: string | null;
}) => {
  // 1. Fetch the reservation
  const reservation = await PaymentsRepo.findBookingForUpdate(reservationId, gamingCenterId);

  if (!reservation) {
    throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
  }

  // 2. Check if the reservation is already paid
  if (reservation.paymentState === ReservationPaymentState.PAID) {
    throw new AppError('Reservation is already paid.', httpStatus.CONFLICT);
  }

  // 3. Create the payment record
  // The idempotency check is now handled by the idempotencyMiddleware.
  // The idempotencyKey is still passed to the repo to enforce the DB constraint.
  const { payment } = await PaymentsRepo.createPaymentAndUpdateBooking({
    reservationId,
    paymentData: {
      gamingCenter: { connect: { id: gamingCenterId } },
      reservation: { connect: { id: reservationId } },
      amount: reservation.totalPrice,
      currency: ((reservation.stationSnapshot as Record<string, unknown>)?.currency as string | undefined || 'USD'),
      provider: PaymentProvider.ZARINPAL, // Hardcoded for MVP
      status: PaymentStatus.INITIATED,
      idempotencyKey,
    },
  });

  // 5. Real ZarinPal API integration
  try {
    const isSandbox = env.ZARINPAL_SANDBOX;
    const baseUrl = isSandbox ? 'https://sandbox.zarinpal.com/pg/v4' : 'https://api.zarinpal.com/pg/v4';
    const startPayUrl = isSandbox ? 'https://sandbox.zarinpal.com/pg/StartPay' : 'https://www.zarinpal.com/pg/StartPay';

    const response = await fetch(`${baseUrl}/payment/request.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchant_id: env.ZARINPAL_MERCHANT_ID,
        amount: reservation.totalPrice,
        callback_url: env.ZARINPAL_CALLBACK_URL,
        description: `Reservation for ${((reservation.stationSnapshot as Record<string, unknown>)?.currency as string | undefined || 'USD')} - ${reservation.id}`,
        metadata: {
          reservationId: reservation.id,
          gamingCenterId: gamingCenterId,
        },
      }),
    });

    const result = (await response.json()) as {
      data: { authority: string; code: number; message: string; fee_type: string; fee: number };
      errors: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    };

    if (result.errors && (Array.isArray(result.errors) ? result.errors.length > 0 : Object.keys(result.errors).length > 0)) {
      console.error('ZarinPal Error:', result.errors);
      throw new AppError('Payment initiation failed with provider.', httpStatus.BAD_GATEWAY);
    }

    if (!result.data || !result.data.authority) {
      console.error('ZarinPal Invalid Response:', result);
      throw new AppError('Invalid response from payment provider.', httpStatus.BAD_GATEWAY);
    }

    const authority = result.data.authority;

    // 6. Update payment with authority
    await PaymentsRepo.updatePayment(payment.id, {
      providerPaymentId: authority,
    });

    return {
      paymentId: payment.id,
      paymentStatus: payment.status,
      checkoutUrl: `${startPayUrl}/${authority}`,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Payment initiation error:', error);
    throw new AppError('Internal error during payment initiation.', httpStatus.INTERNAL_SERVER_ERROR);
  }
};

export const PaymentsService = {
  initiatePayment,
};