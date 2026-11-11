import { Prisma, WalletTransactionType, ReservationPaymentState, PaymentStatus } from '@prisma/client';
import { WalletRepo } from './wallet.repo';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';

export const walletService = {
  async credit(
    customerAccountId: string,
    amount: number,
    type: WalletTransactionType,
    currency: string,
    reservationId?: string,
    note?: string,
    tx?: Prisma.TransactionClient
  ) {
    if (amount <= 0) return;

    const execute = async (t: Prisma.TransactionClient) => {
      await WalletRepo.updateBalance(customerAccountId, amount, t);
      await WalletRepo.createTransaction({
        customerAccountId,
        amount,
        type,
        currency,
        reservationId,
        note,
      }, t);
    };

    if (tx) {
      await execute(tx);
    } else {
      await prisma.$transaction(async (t) => {
        await execute(t);
      });
    }
  },

  async refundReservationToWallet(reservationId: string, tx?: Prisma.TransactionClient) {
    const execute = async (t: Prisma.TransactionClient) => {
      const reservation = await WalletRepo.findReservation(reservationId, t);
      if (!reservation) {
        logger.warn({ msg: 'Cannot refund: reservation not found', reservationId });
        return;
      }

      // Check if already refunded to guarantee strict idempotency
      const existingRefund = await WalletRepo.findRefundTransaction(reservationId, t);
      if (existingRefund) {
        logger.info({ msg: 'Reservation already refunded to wallet', reservationId, refundId: existingRefund.id });
        return;
      }

      // 1. Calculate actual paid amount from verified PAID payment records
      const totalGatewayPaid = await WalletRepo.findTotalPaidForReservation(reservationId, t);

      // 2. Also check if reservation was paid via wallet debit
      const walletDebit = await t.walletTransaction.findFirst({
        where: {
          reservationId,
          type: WalletTransactionType.RESERVATION_PAYMENT,
        },
      });
      const totalWalletPaid = walletDebit ? Math.abs(walletDebit.amount) : 0;

      const totalActualPaid = totalGatewayPaid + totalWalletPaid;

      // If no valid actual payment exists, do not issue an unbacked refund
      if (totalActualPaid <= 0) {
        logger.info({ msg: 'No paid amount found for reservation refund', reservationId });
        return;
      }

      // Cap at customerPayableAmount if customerPayableAmount > 0 to guarantee discounted reservations
      // only refund what was genuinely owed and paid
      const refundAmount = reservation.customerPayableAmount > 0
        ? Math.min(totalActualPaid, reservation.customerPayableAmount)
        : totalActualPaid;

      const currency = ((reservation.stationSnapshot as Record<string, unknown>)?.currency as string | undefined) || 'IRR';

      try {
        await walletService.credit(
          reservation.customerAccountId,
          refundAmount,
          WalletTransactionType.REFUND,
          currency,
          reservationId,
          `استرداد وجه رزرو ${reservationId} به دلیل عدم تأیید در مهلت مقرر`,
          t
        );

        // Update reservation payment state to REFUNDED
        await WalletRepo.updateReservationPaymentState(reservationId, ReservationPaymentState.REFUNDED, t);

        // Mark successful payments as REFUNDED
        await WalletRepo.updatePaymentsStatus(reservationId, PaymentStatus.PAID, PaymentStatus.REFUNDED, t);

        logger.info({
          msg: 'Refunded reservation successfully to customer wallet',
          reservationId,
          customerAccountId: reservation.customerAccountId,
          refundAmount,
          currency,
        });
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
          // Unique constraint violation (unique_reservation_transaction_type on [reservationId, type])
          // Concurrently refunded by another process/worker
          logger.info({ msg: 'Concurrent duplicate refund prevented by unique constraint', reservationId });
          return;
        }
        logger.error({ msg: 'Failed to process wallet refund for reservation', reservationId, error });
        throw error;
      }
    };

    if (tx) {
      await execute(tx);
    } else {
      await prisma.$transaction(async (t) => {
        await execute(t);
      });
    }
  }
};
