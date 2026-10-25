import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { PaymentsStation } from './payments.station';
import { RefundsStation } from './payments.refund.station';
import { LedgerRepo } from './ledger.repo';
import { ReconciliationStation } from './reconciliation.station';
import { LedgerEntryType } from '@prisma/client';

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

const requestRefund = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, paymentId } = req.params;
  const { amount, currency, reason, provider } = req.body;
  const idempotencyKey = req.header('Idempotency-Key');
  const requestedById = req.actor?.id;

  const result = await RefundsStation.requestRefund({
    gamingCenterId: gamingCenterId!,
    paymentId,
    amount,
    currency,
    reason,
    idempotencyKey: idempotencyKey ?? undefined,
    requestedById,
    providerName: provider,
  });

  res.created(result);
};

const getRefundStatus = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, paymentId, refundId } = req.params;

  const result = await RefundsStation.getRefundStatus(gamingCenterId!, paymentId, refundId);

  res.ok(result);
};

const listRefunds = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, paymentId } = req.params;

  const result = await RefundsStation.listRefunds(gamingCenterId!, paymentId);

  res.ok(result);
};

const getLedgerHistory = async (req: AppRequest, res: Response) => {
  const { gamingCenterId } = req.params;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const entryType = req.query.entryType as LedgerEntryType | undefined;
  const paymentId = req.query.paymentId as string | undefined;
  const refundId = req.query.refundId as string | undefined;

  const result = await LedgerRepo.getLedgerHistory({
    gamingCenterId: gamingCenterId!,
    page,
    limit,
    entryType,
    paymentId,
    refundId,
  });

  res.ok(result);
};

const reconcile = async (req: AppRequest, res: Response) => {
  const { gamingCenterId } = req.params;
  const { paymentId, limit } = req.body || {};

  if (paymentId) {
    const result = await ReconciliationStation.reconcilePayment({
      gamingCenterId: gamingCenterId!,
      paymentId,
    });
    res.ok(result);
  } else {
    const result = await ReconciliationStation.reconcileGamingCenter(
      gamingCenterId!,
      limit ? parseInt(String(limit), 10) : 50
    );
    res.ok(result);
  }
};

export const PaymentsController = {
  initiatePayment,
  verifyPayment,
  getPaymentStatus,
  requestRefund,
  getRefundStatus,
  listRefunds,
  getLedgerHistory,
  reconcile,
};
