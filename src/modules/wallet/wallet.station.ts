import { Prisma, WalletTransactionType, ReservationPaymentState, PaymentStatus } from '@prisma/client';
import { WalletRepo } from './wallet.repo';
import { prisma } from '../../config/prisma';

export const WalletService = {
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

  async refundBookingToWallet(reservationId: string, tx?: Prisma.TransactionClient) {
    const execute = async (t: Prisma.TransactionClient) => {
      const reservation = await WalletRepo.findBooking(reservationId, t);
      if (!reservation) return;

      const totalPaid = await WalletRepo.findTotalPaidForBooking(reservationId, t);
      if (totalPaid <= 0) return;

      // Check if already refunded to avoid double refund
      const existingRefund = await t.walletTransaction.findFirst({
        where: {
          reservationId,
          type: WalletTransactionType.REFUND,
        }
      });

      if (existingRefund) return;

      await WalletService.credit(
        reservation.customerAccountId,
        totalPaid,
        WalletTransactionType.REFUND,
        ((reservation.stationSnapshot as Record<string, unknown>)?.currency as string | undefined || 'USD'),
        reservationId,
        `Refund for reservation ${reservationId}`,
        t
      );

      // Update reservation payment state to REFUNDED
      await t.reservation.update({
        where: { id: reservationId },
        data: { paymentState: ReservationPaymentState.REFUNDED }
      });

      // Mark successful payments as REFUNDED
      await t.payment.updateMany({
        where: { reservationId, status: PaymentStatus.PAID },
        data: { status: PaymentStatus.REFUNDED }
      });
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
