import { Request, Response } from 'express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { PaymentsService } from './payments.station';

const initiatePayment = asyncHandler(async (req: Request, res: Response) => {
  const { gamingCenterId, reservationId } = req.params;
  const idempotencyKey = req.header('Idempotency-Key');

  const result = await PaymentsService.initiatePayment({
    gamingCenterId: gamingCenterId!,
    reservationId,
    idempotencyKey: idempotencyKey ?? null,
  });

  res.created(result);
});

export const PaymentsController = {
  initiatePayment,
};
