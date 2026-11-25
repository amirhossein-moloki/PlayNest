import { Prisma, WalletChargeStatus, WalletTransactionType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import {
  formatCurrencyAmount,
  getRecipientPreferredLanguage,
  renderLocalizedNotification,
} from '../notifications/notification-i18n';

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
    const isFailureTransition =
      data.status === WalletChargeStatus.FAILED || data.status === WalletChargeStatus.CANCELLED;
    if (isFailureTransition && typeof client.walletCharge?.updateMany === 'function') {
      await client.walletCharge.updateMany({
        where: { id, status: WalletChargeStatus.PENDING },
        data: data as Prisma.WalletChargeUpdateManyMutationInput,
      });
      return client.walletCharge.findUnique({
        where: { id },
        include: { customerAccount: true },
      });
    }
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
      // 1. Acquire row-level lock on WalletCharge before reading status to prevent TOCTOU double-credit
      if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
        await tx.$executeRaw`SELECT id FROM "WalletCharge" WHERE id = ${chargeId} FOR UPDATE`;
      }

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

      // Guard against crediting a cancelled/terminal charge
      if (charge.status !== WalletChargeStatus.PENDING) {
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
      const chargeLang = getRecipientPreferredLanguage((charge as { customerAccount?: unknown }).customerAccount);
      const localized = renderLocalizedNotification(
        'WALLET_CHARGED',
        { formattedAmount: formatCurrencyAmount(charge.amount, charge.currency, chargeLang) },
        chargeLang
      );

      await tx.customerNotification.create({
        data: {
          customerAccountId: charge.customerAccountId,
          title: localized.title,
          message: localized.message,
          type: 'WALLET_CHARGED',
          metadata: {
            chargeId: charge.id,
            amount: charge.amount,
            trackId: charge.trackId,
            refNumber: verifiedRefNumber,
            language: localized.language,
            direction: localized.direction,
            actionLabel: localized.actionLabel,
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
