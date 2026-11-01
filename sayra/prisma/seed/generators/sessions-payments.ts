import {
  PrismaClient,
  GamingSessionStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentProvider,
  CommissionType,
  CommissionStatus,
  RefundStatus,
  LedgerEntryType,
  WalletTransactionType,
} from '@prisma/client';
import { PRNG } from '../prng';
import { SeededReservationInfo } from './reservations';

export async function seedSessionsAndFinancials(
  prisma: PrismaClient,
  reservations: SeededReservationInfo[],
  prng: PRNG
) {
  for (const res of reservations) {
    if (res.status === 'COMPLETED') {
      await prisma.gamingSession.create({
        data: {
          reservation: { connect: { id: res.id } },
          station: { connect: { id: res.stationId } },
          startTime: res.startTime,
          endTime: res.endTime,
          actualHours: res.totalHours,
          status: GamingSessionStatus.COMPLETED,
        },
      });
    } else if (res.status === 'IN_PROGRESS') {
      await prisma.gamingSession.create({
        data: {
          reservation: { connect: { id: res.id } },
          station: { connect: { id: res.stationId } },
          startTime: res.startTime,
          endTime: null,
          actualHours: 0,
          status: GamingSessionStatus.ACTIVE,
        },
      });
    }

    if (res.paymentState === 'PAID' || res.paymentState === 'REFUNDED') {
      const isOnline = res.source === 'ONLINE';
      const method = isOnline ? PaymentMethod.ONLINE : prng.pick([PaymentMethod.CASH, PaymentMethod.CARD]);
      const provider = isOnline ? PaymentProvider.ZARINPAL : PaymentProvider.MANUAL;

      const payment = await prisma.payment.create({
        data: {
          gamingCenterId: res.gamingCenterId,
          reservationId: res.id,
          amount: Math.round(res.totalPrice),
          currency: 'IRT',
          method,
          provider,
          status: PaymentStatus.PAID,
          paidAt: res.startTime,
          referenceCode: `TRX-${res.id.slice(-8)}-${prng.randInt(1000, 9999)}`,
          providerPaymentId: isOnline ? `ZP-${res.id.slice(-8)}-${prng.randInt(1000, 9999)}` : null,
        },
      });

      const commissionAmount = Math.round(res.totalPrice * 0.05);
      await prisma.earning.create({
        data: {
          reservationId: res.id,
          gamingCenterId: res.gamingCenterId,
          baseAmount: Math.round(res.totalPrice),
          currency: 'IRT',
          type: CommissionType.PERCENT,
          percentBps: 500,
          commissionAmount,
          status: CommissionStatus.ACCRUED,
          createdAt: res.startTime,
        },
      });

      await prisma.ledgerEntry.create({
        data: {
          gamingCenterId: res.gamingCenterId,
          paymentId: payment.id,
          entryType: LedgerEntryType.PAYMENT_COLLECTION,
          amount: Math.round(res.totalPrice),
          currency: 'IRT',
          idempotencyKey: `LEDGER-PAY-${payment.id}`,
          description: `وصول وجه رزرو ${res.id} از درگاه/صندوق`,
          createdAt: res.startTime,
        },
      });

      if (res.paymentState === 'REFUNDED') {
        const refund = await prisma.refund.create({
          data: {
            gamingCenterId: res.gamingCenterId,
            paymentId: payment.id,
            amount: Math.round(res.totalPrice),
            currency: 'IRT',
            status: RefundStatus.SUCCESSFUL,
            reason: 'استرداد وجه پس از لغو سیستمی رزرو',
          },
        });

        await prisma.ledgerEntry.create({
          data: {
            gamingCenterId: res.gamingCenterId,
            refundId: refund.id,
            entryType: LedgerEntryType.REFUND_DISBURSEMENT,
            amount: Math.round(res.totalPrice),
            currency: 'IRT',
            idempotencyKey: `LEDGER-REF-${refund.id}`,
            description: `استرداد وجه به کیف پول/حساب مشتری برای رزرو ${res.id}`,
            createdAt: new Date(res.startTime.getTime() + 1800 * 1000),
          },
        });

        await prisma.walletTransaction.create({
          data: {
            customerAccountId: res.customerAccountId,
            amount: Math.round(res.totalPrice),
            currency: 'IRT',
            type: WalletTransactionType.REFUND,
            reservationId: res.id,
            note: `بازگشت وجه رزرو لغو شده #${res.id.slice(-6)}`,
          },
        });
      }
    }
  }
}
