import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  PaymentStatus,
  ReservationPaymentState,
  ReservationStatus,
  WalletTransactionType,
} from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * In-memory transactional store simulating PostgreSQL row-level locking (FOR UPDATE)
 * and unique constraint (unique_reservation_transaction_type on [reservationId, type]).
 */
interface StoreState {
  reservations: Map<string, any>;
  payments: Map<string, any>;
  customerAccounts: Map<string, any>;
  walletTransactions: any[];
  ledgerEntries: any[];
  reservationHistory: any[];
}

const state: StoreState = {
  reservations: new Map(),
  payments: new Map(),
  customerAccounts: new Map(),
  walletTransactions: [],
  ledgerEntries: [],
  reservationHistory: [],
};

// Per-row async mutex to faithfully simulate PostgreSQL SELECT ... FOR UPDATE serialization
const rowLocks = new Map<string, Promise<void>>();
async function acquireLock(key: string): Promise<() => void> {
  while (rowLocks.has(key)) {
    await rowLocks.get(key);
  }
  let release!: () => void;
  const p = new Promise<void>((res) => {
    release = res;
  });
  rowLocks.set(key, p);
  return () => {
    rowLocks.delete(key);
    release();
  };
}

function createTxClient(heldLocks: Array<() => void>, heldLockKeys: Set<string>) {
  const tx: any = {
    $executeRaw: jest.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const sql = strings.join('?');
      if (sql.includes('FOR UPDATE') && values[0]) {
        const table = sql.includes('"Reservation"') ? 'Reservation' : 'Payment';
        const lockKey = `${table}:${values[0]}`;
        if (!heldLockKeys.has(lockKey)) {
          const release = await acquireLock(lockKey);
          heldLockKeys.add(lockKey);
          heldLocks.push(() => {
            heldLockKeys.delete(lockKey);
            release();
          });
        }
      }
      return 1;
    }),
    payment: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const p = state.payments.get(where.id);
        if (!p) return null;
        const copy = { ...p };
        if (include?.reservation && p.reservationId) {
          copy.reservation = state.reservations.get(p.reservationId)
            ? { ...state.reservations.get(p.reservationId) }
            : null;
        }
        return copy;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return Array.from(state.payments.values())
          .filter((p) => {
            if (where?.reservationId && p.reservationId !== where.reservationId) return false;
            if (where?.status && p.status !== where.status) return false;
            return true;
          })
          .map((p) => ({ ...p }));
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const p = state.payments.get(where.id);
        if (!p) throw new Error('Payment not found');
        Object.assign(p, data);
        return { ...p };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const p of state.payments.values()) {
          if (where?.reservationId && p.reservationId !== where.reservationId) continue;
          if (where?.status && p.status !== where.status) continue;
          Object.assign(p, data);
          count++;
        }
        return { count };
      }),
    },
    reservation: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const r = state.reservations.get(where.id);
        if (!r) return null;
        const copy = { ...r };
        if (include?.customerAccount && r.customerAccountId) {
          copy.customerAccount = state.customerAccounts.get(r.customerAccountId)
            ? { ...state.customerAccounts.get(r.customerAccountId) }
            : null;
        }
        return copy;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const r = state.reservations.get(where.id);
        if (!r) return null;
        if (where.gamingCenterId && r.gamingCenterId !== where.gamingCenterId) return null;
        return { ...r };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const r = state.reservations.get(where.id);
        if (!r) throw new Error('Reservation not found');
        Object.assign(r, data);
        return { ...r };
      }),
    },
    customerAccount: {
      findUnique: jest.fn(async ({ where }: any) => {
        const acc = state.customerAccounts.get(where.id);
        return acc ? { ...acc } : null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const acc = state.customerAccounts.get(where.id);
        if (!acc) throw new Error('CustomerAccount not found');
        if (data.walletBalance?.increment !== undefined) {
          acc.walletBalance += data.walletBalance.increment;
        }
        return { ...acc };
      }),
    },
    walletTransaction: {
      findFirst: jest.fn(async ({ where }: any) => {
        const found = state.walletTransactions.find(
          (wt) =>
            (!where.reservationId || wt.reservationId === where.reservationId) &&
            (!where.type || wt.type === where.type)
        );
        return found ? { ...found } : null;
      }),
      create: jest.fn(async ({ data }: any) => {
        if (data.reservationId && data.type) {
          const dup = state.walletTransactions.find(
            (wt) => wt.reservationId === data.reservationId && wt.type === data.type
          );
          if (dup) {
            const err: any = new Error('Unique constraint failed on the fields: (`reservationId`,`type`)');
            err.code = 'P2002';
            throw err;
          }
        }
        const record = { id: `wt-${state.walletTransactions.length + 1}`, ...data };
        state.walletTransactions.push(record);
        return { ...record };
      }),
    },
    ledgerEntry: {
      findUnique: jest.fn(async ({ where }: any) => {
        const found = state.ledgerEntries.find((le) => le.idempotencyKey === where.idempotencyKey);
        return found ? { ...found } : null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const record = { id: `le-${state.ledgerEntries.length + 1}`, ...data };
        state.ledgerEntries.push(record);
        return record;
      }),
    },
    reservationHistory: {
      create: jest.fn(async ({ data }: any) => {
        state.reservationHistory.push(data);
        return data;
      }),
    },
  };
  return tx;
}

const mockPrisma: any = {
  $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => {
    const heldLocks: Array<() => void> = [];
    const heldLockKeys = new Set<string>();
    const tx = createTxClient(heldLocks, heldLockKeys);
    try {
      return await cb(tx);
    } finally {
      // Release locks in reverse order on commit/rollback
      while (heldLocks.length > 0) {
        const release = heldLocks.pop()!;
        release();
      }
    }
  }),
};

// Wire transaction-less calls directly to a shared non-locking view for simple reads
Object.assign(mockPrisma, createTxClient([], new Set<string>()));

jest.mock('../../../../src/config/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
}));

jest.mock('../../../../src/modules/commissions/commissions.station', () => ({
  commissionsStation: {
    calculateCommission: jest.fn().mockImplementation(() => Promise.resolve()),
  },
}));

import { PaymentsRepo } from '../../../../src/modules/payments/payments.repo';
import { walletService } from '../../../../src/modules/wallet/wallet.station';

describe('Wallet Refund Race Conditions, Late Callbacks & Idempotency', () => {
  const gamingCenterId = 'gc-1';
  const customerAccountId = 'cust-1';
  const reservationId = 'res-1';

  beforeEach(() => {
    jest.clearAllMocks();
    rowLocks.clear();
    state.reservations.clear();
    state.payments.clear();
    state.customerAccounts.clear();
    state.walletTransactions = [];
    state.ledgerEntries = [];
    state.reservationHistory = [];

    state.customerAccounts.set(customerAccountId, {
      id: customerAccountId,
      walletBalance: 0,
    });

    state.reservations.set(reservationId, {
      id: reservationId,
      gamingCenterId,
      customerAccountId,
      status: ReservationStatus.PENDING,
      paymentState: ReservationPaymentState.PENDING,
      customerPayableAmount: 100000,
      stationSnapshot: { currency: 'IRR' },
    });

    state.payments.set('pay-1', {
      id: 'pay-1',
      gamingCenterId,
      reservationId,
      amount: 100000,
      currency: 'IRR',
      status: PaymentStatus.PENDING,
      referenceCode: null,
    });
  });

  async function cancelReservationTx(resId: string, newStatus: ReservationStatus = ReservationStatus.CANCELED) {
    return mockPrisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT id FROM "Reservation" WHERE id = ${resId} FOR UPDATE`;
      const res = await tx.reservation.findUnique({ where: { id: resId } });
      if (!res || res.status === newStatus) {
        return res;
      }
      await tx.reservation.update({
        where: { id: resId },
        data: { status: newStatus, canceledAt: new Date() },
      });
      await walletService.refundReservationToWallet(resId, tx);
      return tx.reservation.findUnique({ where: { id: resId } });
    });
  }

  async function confirmPaymentTx(payId: string, refId = 'ref-001') {
    return mockPrisma.$transaction(async (tx: any) => {
      return PaymentsRepo.handleSuccessfulPayment(tx, payId, refId);
    });
  }

  it('1. Payment success followed by cancellation refunds exact paid amount once', async () => {
    await confirmPaymentTx('pay-1', 'ref-101');
    expect(state.reservations.get(reservationId).status).toBe(ReservationStatus.CONFIRMED);
    expect(state.reservations.get(reservationId).paymentState).toBe(ReservationPaymentState.PAID);
    expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(0);

    await cancelReservationTx(reservationId, ReservationStatus.CANCELED);

    expect(state.reservations.get(reservationId).status).toBe(ReservationStatus.CANCELED);
    expect(state.reservations.get(reservationId).paymentState).toBe(ReservationPaymentState.REFUNDED);
    expect(state.payments.get('pay-1').status).toBe(PaymentStatus.REFUNDED);
    expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(100000);
    expect(state.walletTransactions).toHaveLength(1);
    expect(state.walletTransactions[0]).toMatchObject({
      customerAccountId,
      reservationId,
      amount: 100000,
      type: WalletTransactionType.REFUND,
    });
  });

  it('2. Cancellation followed by late successful payment callback refunds to wallet and does not resurrect reservation', async () => {
    await cancelReservationTx(reservationId, ReservationStatus.CANCELED);
    expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(0);
    expect(state.walletTransactions).toHaveLength(0);

    // Late successful payment callback arrives
    await confirmPaymentTx('pay-1', 'ref-late');

    expect(state.reservations.get(reservationId).status).toBe(ReservationStatus.CANCELED);
    expect(state.reservations.get(reservationId).paymentState).toBe(ReservationPaymentState.REFUNDED);
    expect(state.payments.get('pay-1').status).toBe(PaymentStatus.REFUNDED);
    expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(100000);
    expect(state.walletTransactions).toHaveLength(1);
    expect(state.walletTransactions[0].amount).toBe(100000);
  });

  it('3. Expiration followed by late successful payment callback refunds to wallet and keeps EXPIRED status', async () => {
    await cancelReservationTx(reservationId, ReservationStatus.EXPIRED);
    expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(0);

    await confirmPaymentTx('pay-1', 'ref-late-exp');

    expect(state.reservations.get(reservationId).status).toBe(ReservationStatus.EXPIRED);
    expect(state.reservations.get(reservationId).paymentState).toBe(ReservationPaymentState.REFUNDED);
    expect(state.payments.get('pay-1').status).toBe(PaymentStatus.REFUNDED);
    expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(100000);
    expect(state.walletTransactions).toHaveLength(1);
  });

  it('4. Concurrent cancellation and payment callback result in exactly one refund', async () => {
    await Promise.all([
      confirmPaymentTx('pay-1', 'ref-concurrent'),
      cancelReservationTx(reservationId, ReservationStatus.CANCELED),
    ]);

    expect(state.reservations.get(reservationId).status).toBe(ReservationStatus.CANCELED);
    expect(state.reservations.get(reservationId).paymentState).toBe(ReservationPaymentState.REFUNDED);
    expect(state.payments.get('pay-1').status).toBe(PaymentStatus.REFUNDED);
    expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(100000);
    expect(state.walletTransactions).toHaveLength(1);
  });

  it('5. Duplicate payment callbacks (sequential & concurrent) never cause duplicate refunds', async () => {
    await cancelReservationTx(reservationId, ReservationStatus.CANCELED);

    await Promise.all([
      confirmPaymentTx('pay-1', 'ref-dup-1'),
      confirmPaymentTx('pay-1', 'ref-dup-2'),
      confirmPaymentTx('pay-1', 'ref-dup-3'),
    ]);

    // Also another sequential duplicate callback
    await confirmPaymentTx('pay-1', 'ref-dup-4');

    expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(100000);
    expect(state.walletTransactions).toHaveLength(1);
    expect(state.payments.get('pay-1').status).toBe(PaymentStatus.REFUNDED);
  });

  it('6. Multiple concurrent and sequential cancellation requests refund only once', async () => {
    await confirmPaymentTx('pay-1', 'ref-paid');

    await Promise.all([
      cancelReservationTx(reservationId, ReservationStatus.CANCELED),
      cancelReservationTx(reservationId, ReservationStatus.CANCELED),
      cancelReservationTx(reservationId, ReservationStatus.CANCELED),
    ]);

    await walletService.refundReservationToWallet(reservationId);

    expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(100000);
    expect(state.walletTransactions).toHaveLength(1);
  });

  it('7. Failed payments are never refunded upon cancellation', async () => {
    await mockPrisma.$transaction(async (tx: any) => {
      await PaymentsRepo.handleFailedPayment(tx, 'pay-1', PaymentStatus.FAILED, 'Bank declined');
    });

    await cancelReservationTx(reservationId, ReservationStatus.CANCELED);

    expect(state.payments.get('pay-1').status).toBe(PaymentStatus.FAILED);
    expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(0);
    expect(state.walletTransactions).toHaveLength(0);
  });

  it('8. Multiple payments for one reservation (one failed + one paid, or two partial paid) refund exact paid total', async () => {
    state.payments.set('pay-1', {
      id: 'pay-1',
      gamingCenterId,
      reservationId,
      amount: 40000,
      currency: 'IRR',
      status: PaymentStatus.PENDING,
    });
    state.payments.set('pay-2', {
      id: 'pay-2',
      gamingCenterId,
      reservationId,
      amount: 60000,
      currency: 'IRR',
      status: PaymentStatus.PENDING,
    });
    state.payments.set('pay-failed', {
      id: 'pay-failed',
      gamingCenterId,
      reservationId,
      amount: 100000,
      currency: 'IRR',
      status: PaymentStatus.FAILED,
    });

    await confirmPaymentTx('pay-1', 'ref-p1');
    await confirmPaymentTx('pay-2', 'ref-p2');
    await cancelReservationTx(reservationId, ReservationStatus.CANCELED);

    expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(100000);
    expect(state.walletTransactions).toHaveLength(1);
    expect(state.walletTransactions[0].amount).toBe(100000);
    expect(state.payments.get('pay-1').status).toBe(PaymentStatus.REFUNDED);
    expect(state.payments.get('pay-2').status).toBe(PaymentStatus.REFUNDED);
    expect(state.payments.get('pay-failed').status).toBe(PaymentStatus.FAILED);
  });

  it('9. Already-refunded reservations do not receive excessive or duplicate refunds', async () => {
    await confirmPaymentTx('pay-1', 'ref-1');
    await cancelReservationTx(reservationId, ReservationStatus.CANCELED);

    expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(100000);

    // Attempt direct refund again + duplicate callback
    await walletService.refundReservationToWallet(reservationId);
    await confirmPaymentTx('pay-1', 'ref-1');

    expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(100000);
    expect(state.walletTransactions).toHaveLength(1);
  });
});
