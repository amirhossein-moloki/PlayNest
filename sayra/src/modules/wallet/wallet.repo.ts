import { Prisma, PaymentStatus, WalletTransactionType, ReservationPaymentState } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const WalletRepo = {
  async updateBalance(customerAccountId: string, amount: number, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
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

    if (payments.length === 0) return 0;

    return payments.reduce((acc, p) => acc + p.amount, 0);
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
