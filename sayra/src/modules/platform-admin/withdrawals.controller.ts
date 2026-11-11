import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { WithdrawalStation } from '../wallet/withdrawal.station';
import { auditService } from '../audit/audit.station';
import { SessionActorType } from '@prisma/client';

export const PlatformWithdrawalsController = {
  async listWithdrawals(req: AppRequest, res: Response) {
    const result = await WithdrawalStation.listAllWithdrawals(req.query as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    res.ok(result.data, { pagination: result.meta });
  },

  async getOverdueWithdrawals(_req: AppRequest, res: Response) {
    const result = await WithdrawalStation.getOverdueWithdrawals();
    res.ok(result.data, { pagination: result.meta as any }); // eslint-disable-line @typescript-eslint/no-explicit-any
  },

  async getWithdrawalById(req: AppRequest, res: Response) {
    const { id } = req.params;
    const withdrawal = await WithdrawalStation.getWithdrawalDetails(id);
    res.ok(withdrawal);
  },

  async approveWithdrawal(req: AppRequest, res: Response) {
    const { id } = req.params;
    const adminId = req.actor.id;
    const { note } = req.body;

    const oldWithdrawal = await WithdrawalStation.getWithdrawalDetails(id);
    const updated = await WithdrawalStation.approveWithdrawal(id, adminId, note);

    await auditService.log(
      'PLATFORM',
      { id: adminId, actorType: SessionActorType.PLATFORM_ADMIN },
      'WITHDRAWAL_APPROVED',
      { name: 'WithdrawalRequest', id },
      { old: oldWithdrawal, new: updated },
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    res.ok(updated);
  },

  async rejectWithdrawal(req: AppRequest, res: Response) {
    const { id } = req.params;
    const adminId = req.actor.id;
    const { reason, note } = req.body;

    const oldWithdrawal = await WithdrawalStation.getWithdrawalDetails(id);
    const updated = await WithdrawalStation.rejectWithdrawal(id, adminId, reason, note);

    await auditService.log(
      'PLATFORM',
      { id: adminId, actorType: SessionActorType.PLATFORM_ADMIN },
      'WITHDRAWAL_REJECTED',
      { name: 'WithdrawalRequest', id },
      { old: oldWithdrawal, new: { ...updated, reason } },
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    res.ok(updated);
  },

  async updateWithdrawalPayment(req: AppRequest, res: Response) {
    const { id } = req.params;
    const adminId = req.actor.id;
    const { status, paymentReference, note } = req.body;

    const oldWithdrawal = await WithdrawalStation.getWithdrawalDetails(id);
    const updated = await WithdrawalStation.updateWithdrawalPayment(id, adminId, {
      status,
      paymentReference,
      note,
    });

    await auditService.log(
      'PLATFORM',
      { id: adminId, actorType: SessionActorType.PLATFORM_ADMIN },
      `WITHDRAWAL_PAYMENT_${status}`,
      { name: 'WithdrawalRequest', id },
      { old: oldWithdrawal, new: { ...updated, paymentReference } },
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    res.ok(updated);
  },
};
