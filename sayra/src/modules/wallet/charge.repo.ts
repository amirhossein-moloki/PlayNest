import { Prisma, WalletChargeStatus, WalletTransactionType } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const WalletChargeRepo = {
  async createCharge(data: Prisma.WalletChargeUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.walletCharge.create({ data });
  },

  async findChargeById(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.walletCharge.findUnique({
      where: { id },
      include: {
        customerAccount: true,
      },
    });
  },

  async findChargeByIdAndCustomer(id: string, customerAccountId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.walletCharge.findFirst({
      where: { id, customerAccountId },
      include: {
        customerAccount: true,
      },
    });
  },

  async findChargeByTrackId(trackId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.walletCharge.findUnique({
      where: { trackId },
      include: {
        customerAccount: true,
      },
    });
  },

  async findChargeByIdempotencyKey(customerAccountId: string, idempotencyKey: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.walletCharge.findUnique({
      where: {
        customer_idempotency_key: {
          customerAccountId,
          idempotencyKey,
        },
      },
    });
  },

  async updateCharge(id: string, data: Prisma.WalletChargeUpdateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.walletCharge.update({
      where: { id },
      data,
      include: {
        customerAccount: true,
      },
    });
  },

  async executeAtomicCredit(
    chargeId: string,
    verifiedRefNumber?: string,
    rawPayload?: Prisma.InputJsonValue,
    externalTx?: Prisma.TransactionClient
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Fetch charge with pessimistic locking if postgres, or verify status inside transaction
      const charge = await tx.walletCharge.findUnique({
        where: { id: chargeId },
      });

      if (!charge) {
        throw new Error('WALLET_CHARGE_NOT_FOUND');
      }

      // Idempotency: If already marked PAID, return existing charge immediately without re-crediting
      if (charge.status === WalletChargeStatus.PAID) {
        return charge;
      }

      // 2. Lock customer account row to guarantee serial balance update
      await tx.$executeRaw`SELECT id FROM "CustomerAccount" WHERE id = ${charge.customerAccountId} FOR UPDATE`;

      // 3. Mark charge as PAID
      const updatedCharge = await tx.walletCharge.update({
        where: { id: chargeId },
        data: {
          status: WalletChargeStatus.PAID,
          paidAt: new Date(),
          refNumber: verifiedRefNumber || charge.refNumber,
          rawProviderPayload: rawPayload ?? (charge.rawProviderPayload as Prisma.InputJsonValue | undefined),
        },
        include: {
          customerAccount: true,
        },
      });

      // 4. Atomically increment walletBalance
      await tx.customerAccount.update({
        where: { id: charge.customerAccountId },
        data: {
          walletBalance: {
            increment: charge.amount,
          },
        },
      });

      // 5. Create immutable wallet deposit transaction
      await tx.walletTransaction.create({
        data: {
          customerAccountId: charge.customerAccountId,
          amount: charge.amount,
          currency: charge.currency,
          type: WalletTransactionType.DEPOSIT,
          walletChargeId: charge.id,
          note: `شارژ آنلاین کیف پول از طریق درگاه زیبال (شناسه پیگیری: ${charge.trackId || charge.id})`,
        },
      });

      // 6. Create in-app customer notification
      await tx.customerNotification.create({
        data: {
          customerAccountId: charge.customerAccountId,
          title: 'کیف پول شارژ شد',
          message: `کیف پول شما به مبلغ ${charge.amount.toLocaleString('fa-IR')} ریال با موفقیت شارژ شد.`,
          type: 'WALLET_CHARGED',
          metadata: {
            chargeId: charge.id,
            amount: charge.amount,
            trackId: charge.trackId,
            refNumber: verifiedRefNumber,
          },
        },
      });

      return updatedCharge;
    };

    if (externalTx) {
      return execute(externalTx);
    }
    return prisma.$transaction(execute);
  },
};
