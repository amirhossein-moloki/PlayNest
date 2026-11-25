import { Prisma, PaymentStatus, WalletTransactionType, ReservationPaymentState } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getAvailableWalletBalance } from './wallet-access.guard';

export const WalletRepo = {
  async updateBalance(customerAccountId: string, amount: number, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    // Check non-negative spendable balance requirement if debiting (excluding reservedBalance)
    if (amount < 0) {
      if (tx && typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
        await tx.$executeRaw`SELECT id FROM "CustomerAccount" WHERE id = ${customerAccountId} FOR UPDATE`;
      }
      const account = await client.customerAccount.findUnique({
        where: { id: customerAccountId },
        select: { walletBalance: true, reservedBalance: true },
      });
      if (!account || getAvailableWalletBalance(account) + amount < 0) {
        throw new Error('INSUFFICIENT_BALANCE');
      }
    }

    return client.customerAccount.update({
      where: { id: customerAccountId },
      data: {
        walletBalance: {
          increment: amount,
        },
      },
    });
  },

  async createTransaction(data: Prisma.WalletTransactionUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.walletTransaction.create({ data });
  },

  async findTotalPaidForReservation(reservationId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const payments = await client.payment.findMany({
      where: {
        reservationId,
        status: PaymentStatus.PAID,
      },
    });

    if (payments.length > 0) {
      return payments.reduce((acc, p) => acc + p.amount, 0);
    }

    // Fallback: check if this reservation was paid via a GroupBooking / BookingHold payment
    const reservation = await client.reservation.findUnique({
      where: { id: reservationId },
      select: {
        groupBookingId: true,
        customerPayableAmount: true,
        totalPrice: true,
      },
    });

    if (!reservation?.groupBookingId) return 0;

    const groupPayments = await client.payment.findMany({
      where: {
        groupBookingId: reservation.groupBookingId,
        status: PaymentStatus.PAID,
      },
    });

    if (groupPayments.length === 0) return 0;

    const totalGroupPaid = groupPayments.reduce((acc, p) => acc + p.amount, 0);
    const reservationShare =
      reservation.customerPayableAmount > 0
        ? reservation.customerPayableAmount
        : reservation.totalPrice;

    return reservationShare > 0 ? Math.min(totalGroupPaid, reservationShare) : totalGroupPaid;
  },

  async findReservation(reservationId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.reservation.findUnique({
      where: { id: reservationId },
      include: {
        customerAccount: true,
      },
    });
  },

  async findRefundTransaction(reservationId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.walletTransaction.findFirst({
      where: {
        reservationId,
        type: WalletTransactionType.REFUND,
      },
    });
  },

  async updateReservationPaymentState(
    reservationId: string,
    paymentState: ReservationPaymentState,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.reservation.update({
      where: { id: reservationId },
      data: { paymentState },
    });
  },

  async updatePaymentsStatus(
    reservationId: string,
    oldStatus: PaymentStatus,
    newStatus: PaymentStatus,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.payment.updateMany({
      where: { reservationId, status: oldStatus },
      data: { status: newStatus },
    });
  },
};
