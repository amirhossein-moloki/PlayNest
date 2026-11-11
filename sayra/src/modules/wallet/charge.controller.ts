import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { WalletChargeStation } from './charge.station';

export const initiateWalletCharge = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { amount, currency } = req.body;
  const idempotencyKey = (req.header('idempotency-key') || req.header('Idempotency-Key')) || null;

  const result = await WalletChargeStation.initiateCharge({
    customerAccountId,
    amount,
    currency,
    idempotencyKey,
  });

  res.created(result);
};

export const getWalletChargeStatus = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { chargeId } = req.params;

  const result = await WalletChargeStation.getChargeStatus(chargeId, customerAccountId);
  res.ok(result);
};
