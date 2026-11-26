import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { gamingCenterWalletStation } from './gamingCenterWallet.station';

export const GamingCenterWalletController = {
  async getWalletOverview(req: AppRequest, res: Response) {
    const overview = await gamingCenterWalletStation.getWalletOverview(req.tenant.gamingCenterId);
    res.ok(overview);
  },

  async requestWithdrawal(req: AppRequest, res: Response) {
    const { amount, bankDetails, note } = req.body;
    const withdrawal = await gamingCenterWalletStation.requestWithdrawal(
      {
        gamingCenterId: req.tenant.gamingCenterId,
        amount,
        bankDetails,
        note,
      },
      req.actor,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.created(withdrawal);
  },

  async listWithdrawals(req: AppRequest, res: Response) {
    const result = await gamingCenterWalletStation.listGamingCenterWithdrawals(
      req.tenant.gamingCenterId,
      req.query
    );
    res.ok(result.data, { pagination: result.meta });
  },

  async getWithdrawalDetails(req: AppRequest, res: Response) {
    const { id } = req.params;
    const withdrawal = await gamingCenterWalletStation.getWithdrawalDetails(
      id,
      req.tenant.gamingCenterId
    );
    res.ok(withdrawal);
  },

  async listTransactions(req: AppRequest, res: Response) {
    const result = await gamingCenterWalletStation.listGamingCenterTransactions(
      req.tenant.gamingCenterId,
      req.query
    );
    res.ok(result.data, { pagination: result.meta });
  },

  async getTransactionDetails(req: AppRequest, res: Response) {
    const { id } = req.params;
    const transaction = await gamingCenterWalletStation.getGamingCenterTransaction(
      id,
      req.tenant.gamingCenterId
    );
    res.ok(transaction);
  },
};
