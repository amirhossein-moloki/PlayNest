import { Response } from 'express';
import { SessionActorType } from '@prisma/client';
import { AppRequest } from '../../types/express';
import { gamingCenterWalletStation } from '../gaming-center-wallet/gamingCenterWallet.station';
import { auditService } from '../audit/audit.station';

export const PlatformGamingCenterWithdrawalsController = {
  async listWithdrawals(req: AppRequest, res: Response) {
    const result = await gamingCenterWalletStation.listAllWithdrawals(req.query as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    res.ok(result.data, { pagination: result.meta });
  },

  async getOverdueWithdrawals(_req: AppRequest, res: Response) {
    const result = await gamingCenterWalletStation.getOverdueWithdrawals();
    res.ok(result.data, { pagination: result.meta as any }); // eslint-disable-line @typescript-eslint/no-explicit-any
  },

  async getWithdrawalById(req: AppRequest, res: Response) {
    const { id } = req.params;
    const withdrawal = await gamingCenterWalletStation.getWithdrawalDetails(id);
    res.ok(withdrawal);
  },

  async approveWithdrawal(req: AppRequest, res: Response) {
    const { id } = req.params;
    const adminId = req.actor.id;
    const { note } = req.body;

    const oldWithdrawal = await gamingCenterWalletStation.getWithdrawalDetails(id);
    const updated = await gamingCenterWalletStation.approveWithdrawal(id, adminId, note);

    await auditService.log(
      oldWithdrawal.gamingCenterId || 'PLATFORM',
      { id: adminId, actorType: SessionActorType.PLATFORM_ADMIN },
      'GAMING_CENTER_WITHDRAWAL_APPROVED',
      { name: 'GamingCenterWithdrawalRequest', id },
      { old: oldWithdrawal, new: updated },
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    res.ok(updated);
  },

  async rejectWithdrawal(req: AppRequest, res: Response) {
    const { id } = req.params;
    const adminId = req.actor.id;
    const { reason, note } = req.body;

    const oldWithdrawal = await gamingCenterWalletStation.getWithdrawalDetails(id);
    const updated = await gamingCenterWalletStation.rejectWithdrawal(id, adminId, reason, note);

    await auditService.log(
      oldWithdrawal.gamingCenterId || 'PLATFORM',
      { id: adminId, actorType: SessionActorType.PLATFORM_ADMIN },
      'GAMING_CENTER_WITHDRAWAL_REJECTED',
      { name: 'GamingCenterWithdrawalRequest', id },
      { old: oldWithdrawal, new: { ...updated, reason } },
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    res.ok(updated);
  },

  async updateWithdrawalPayment(req: AppRequest, res: Response) {
    const { id } = req.params;
    const adminId = req.actor.id;
    const { status, paymentReference, note } = req.body;

    const oldWithdrawal = await gamingCenterWalletStation.getWithdrawalDetails(id);
    const updated = await gamingCenterWalletStation.updateWithdrawalPayment(id, adminId, {
      status,
      paymentReference,
      note,
    });

    await auditService.log(
      oldWithdrawal.gamingCenterId || 'PLATFORM',
      { id: adminId, actorType: SessionActorType.PLATFORM_ADMIN },
      `GAMING_CENTER_WITHDRAWAL_PAYMENT_${status}`,
      { name: 'GamingCenterWithdrawalRequest', id },
      { old: oldWithdrawal, new: { ...updated, paymentReference } },
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    res.ok(updated);
  },
};
