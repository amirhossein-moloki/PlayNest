import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { PaymentsService } from './payments.station';

const initiatePayment = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, reservationId } = req.params;
  const idempotencyKey = req.header('Idempotency-Key');

  const result = await PaymentsService.initiatePayment({
    gamingCenterId: gamingCenterId!,
    reservationId,
    idempotencyKey: idempotencyKey ?? null,
  });

  res.created(result);
};

export const PaymentsController = {
  initiatePayment,
};
