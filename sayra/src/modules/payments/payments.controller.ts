import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { PaymentsStation } from './payments.station';

const initiatePayment = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, reservationId } = req.params;
  const idempotencyKey = req.header('Idempotency-Key');
  const providerName = req.body?.provider;

  const result = await PaymentsStation.initiatePayment({
    gamingCenterId: gamingCenterId!,
    reservationId,
    idempotencyKey: idempotencyKey ?? null,
    providerName,
  });

  res.created(result);
};

const verifyPayment = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, reservationId } = req.params;

  const authority = (req.query.Authority || req.query.authority || req.body?.authority) as string | undefined;
  const status = (req.query.Status || req.query.status || req.body?.status) as string | undefined;
  const providerName = req.body?.provider;

  const result = await PaymentsStation.verifyPayment({
    gamingCenterId: gamingCenterId!,
    reservationId,
    authority,
    status,
    providerName,
  });

  res.ok(result);
};

const getPaymentStatus = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, reservationId } = req.params;

  const result = await PaymentsStation.getPaymentStatus({
    gamingCenterId: gamingCenterId!,
    reservationId,
  });

  res.ok(result);
};

export const PaymentsController = {
  initiatePayment,
  verifyPayment,
  getPaymentStatus,
};
