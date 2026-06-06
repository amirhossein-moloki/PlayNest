import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { PaymentsStation } from './payments.station';

const initiatePayment = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, reservationId } = req.params;
  const idempotencyKey = req.header('Idempotency-Key');

  const result = await PaymentsStation.initiatePayment({
    gamingCenterId: gamingCenterId!,
    reservationId,
    idempotencyKey: idempotencyKey ?? null,
  });

  res.created(result);
};

export const PaymentsController = {
  initiatePayment,
};
