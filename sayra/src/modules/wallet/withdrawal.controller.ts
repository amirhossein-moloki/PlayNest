import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { WithdrawalStation } from './withdrawal.station';

export const getMyWallet = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const overview = await WithdrawalStation.getWalletOverview(customerAccountId);
  res.ok(overview);
};

export const createWithdrawalRequest = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { amount, bankDetails, note } = req.body;

  const withdrawal = await WithdrawalStation.requestWithdrawal({
    customerAccountId,
    amount,
    bankDetails,
    note,
  });

  res.created(withdrawal);
};

export const listMyWithdrawals = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const result = await WithdrawalStation.listCustomerWithdrawals(customerAccountId, req.query);
  res.ok(result.data, { pagination: result.meta });
};

export const getMyWithdrawalDetails = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { id } = req.params;
  const withdrawal = await WithdrawalStation.getWithdrawalDetails(id, customerAccountId);
  res.ok(withdrawal);
};

export const listMyTransactions = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const result = await WithdrawalStation.listCustomerTransactions(customerAccountId, req.query);
  res.ok(result.data, { pagination: result.meta });
};

export const getMyTransactionDetails = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { id } = req.params;
  const tx = await WithdrawalStation.getCustomerTransaction(id, customerAccountId);
  res.ok(tx);
};

export const listMyNotifications = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const result = await WithdrawalStation.listCustomerNotifications(customerAccountId, req.query);
  res.ok({ items: result.data, unreadCount: result.unreadCount }, { pagination: result.meta });
};

export const markMyNotificationAsRead = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { id } = req.params;
  const result = await WithdrawalStation.markNotificationRead(id, customerAccountId);
  res.ok(result);
};
