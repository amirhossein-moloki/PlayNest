import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  CancellationActor,
  CancellationCategory,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  ReservationPaymentState,
  ReservationStatus,
  SessionActorType,
  WalletTransactionType,
} from '@prisma/client';
import httpStatus from 'http-status';
import AppError from '../../../../src/common/errors/AppError';
import { calculatePaymentSplit } from '../../../../src/modules/payments/payment-calculation';

/* eslint-disable @typescript-eslint/no-explicit-any */

// In-memory state
interface StoreState {
  reservations: Map<string, any>;
  payments: Map<string, any>;
  customerAccounts: Map<string, any>;
  walletTransactions: any[];
  ledgerEntries: any[];
}

const state: StoreState = {
  reservations: new Map(),
  payments: new Map(),
  customerAccounts: new Map(),
  walletTransactions: [],
  ledgerEntries: [],
};

// Simulated row-level mutex for PostgreSQL FOR UPDATE
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
        const table = sql.includes('"Reservation"')
          ? 'Reservation'
          : sql.includes('"CustomerAccount"')
          ? 'CustomerAccount'
          : 'Payment';
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
      create: jest.fn(async ({ data }: any) => {
        const id = `pay-${state.payments.size + 1}`;
        const record = {
          id,
          gamingCenterId: data.gamingCenter?.connect?.id || data.gamingCenterId,
          reservationId: data.reservation?.connect?.id || data.reservationId,
          amount: data.amount,
          walletAmount: data.walletAmount || 0,
          currency: data.currency || 'IRR',
          provider: data.provider || PaymentProvider.MANUAL,
          method: data.method || PaymentMethod.ONLINE,
          status: data.status || PaymentStatus.INITIATED,
          paidAt: data.paidAt || null,
          referenceCode: data.referenceCode || null,
          idempotencyKey: data.idempotencyKey || null,
          createdAt: new Date(),
        };
        state.payments.set(id, record);
        return { ...record };
      }),
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
      findFirst: jest.fn(async ({ where, include }: any) => {
        for (const p of state.payments.values()) {
          if (where.id && p.id !== where.id) continue;
          if (where.providerPaymentId && p.providerPaymentId !== where.providerPaymentId) continue;
          if (where.reservationId && p.reservationId !== where.reservationId) continue;
          if (where.gamingCenterId && p.gamingCenterId !== where.gamingCenterId) continue;
          const copy = { ...p };
          if (include?.reservation && p.reservationId) {
            copy.reservation = state.reservations.get(p.reservationId)
              ? { ...state.reservations.get(p.reservationId) }
              : null;
          }
          return copy;
        }
        return null;
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
      findFirst: jest.fn(async ({ where, include }: any) => {
        const r = state.reservations.get(where.id);
        if (!r) return null;
        if (where.gamingCenterId && r.gamingCenterId !== where.gamingCenterId) return null;
        const copy = { ...r };
        if (include?.customerAccount && r.customerAccountId) {
          copy.customerAccount = state.customerAccounts.get(r.customerAccountId)
            ? { ...state.customerAccounts.get(r.customerAccountId) }
            : null;
        }
        return copy;
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
        if (data.walletBalance?.decrement !== undefined) {
          acc.walletBalance -= data.walletBalance.decrement;
        }
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
            (!where.paymentId || wt.paymentId === where.paymentId) &&
            (!where.type || wt.type === where.type)
        );
        return found ? { ...found } : null;
      }),
      create: jest.fn(async ({ data }: any) => {
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
        const record = {
          id: `le-${state.ledgerEntries.length + 1}`,
          ...data,
          paymentId: data.payment?.connect?.id || data.paymentId,
          gamingCenterId: data.gamingCenter?.connect?.id || data.gamingCenterId,
        };
        state.ledgerEntries.push(record);
        return record;
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
      while (heldLocks.length > 0) {
        heldLocks.pop()!();
      }
    }
  }),
  payment: {
    findFirst: jest.fn(async ({ where, include, orderBy }: any) => {
      const list = Array.from(state.payments.values()).filter((p) => {
        if (where?.id && p.id !== where.id) return false;
        if (where?.providerPaymentId && p.providerPaymentId !== where.providerPaymentId) return false;
        if (where?.reservationId && p.reservationId !== where.reservationId) return false;
        if (where?.gamingCenterId && p.gamingCenterId !== where.gamingCenterId) return false;
        if (where?.status && p.status !== where.status) return false;
        if (where?.idempotencyKey && p.idempotencyKey !== where.idempotencyKey) return false;
        return true;
      });
      if (orderBy?.createdAt === 'desc') {
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      const p = list[0];
      if (!p) return null;
      const copy = { ...p };
      if (include?.reservation && p.reservationId) {
        copy.reservation = state.reservations.get(p.reservationId)
          ? { ...state.reservations.get(p.reservationId) }
          : null;
      }
      return copy;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const p = state.payments.get(where.id);
      if (!p) throw new Error('Payment not found');
      Object.assign(p, data);
      return { ...p };
    }),
  },
  reservation: {
    findFirst: jest.fn(async ({ where, include }: any) => {
      const r = state.reservations.get(where.id);
      if (!r) return null;
      if (where.gamingCenterId && r.gamingCenterId !== where.gamingCenterId) return null;
      const copy = { ...r };
      if (include?.customerAccount && r.customerAccountId) {
        copy.customerAccount = state.customerAccounts.get(r.customerAccountId)
          ? { ...state.customerAccounts.get(r.customerAccountId) }
          : null;
      }
      return copy;
    }),
    findUnique: jest.fn(async ({ where }: any) => {
      const r = state.reservations.get(where.id);
      return r ? { ...r } : null;
    }),
  },
  customerAccount: {
    findUnique: jest.fn(async ({ where }: any) => {
      const acc = state.customerAccounts.get(where.id);
      return acc ? { ...acc } : null;
    }),
  },
};

// Mock modules
jest.mock('../../../../src/config/prisma', () => ({
  prisma: mockPrisma,
}));

const mockProvider = {
  name: 'ZARINPAL',
  initiatePayment: jest.fn() as any,
  verifyPayment: jest.fn() as any,
};

jest.mock('../../../../src/modules/payments/providers', () => ({
  PaymentProviderFactory: {
    getProvider: jest.fn(() => mockProvider),
  },
}));

jest.mock('../../../../src/modules/commissions/commissions.station', () => ({
  commissionsStation: {
    calculateCommission: jest.fn(async () => ({})),
  },
}));

import { PaymentsRepo } from '../../../../src/modules/payments/payments.repo';
import { PaymentProviderFactory } from '../../../../src/modules/payments/providers';
import { PaymentsStation } from '../../../../src/modules/payments/payments.station';

describe('Wallet Payment and Partial Payment Module', () => {
  const gamingCenterId = 'gc-100';
  const customerAccountId = 'cust-100';
  const reservationId = 'res-100';

  beforeEach(() => {
    state.reservations.clear();
    state.payments.clear();
    state.customerAccounts.clear();
    state.walletTransactions = [];
    state.ledgerEntries = [];
    rowLocks.clear();
    jest.clearAllMocks();

    mockProvider.initiatePayment.mockResolvedValue({
      providerPaymentId: 'auth-12345',
      providerCheckoutId: 'checkout-12345',
      checkoutUrl: 'https://gateway.example.com/pay/auth-12345',
    });

    mockProvider.verifyPayment.mockResolvedValue({
      success: true,
      refId: 'ref-99999',
      status: PaymentStatus.PAID,
    });
  });

  describe('1. Calculation Logic (calculatePaymentSplit)', () => {
    it('Scenario A: wallet balance covers full amount when enabled', () => {
      const result = calculatePaymentSplit({
        totalPayable: 100,
        walletBalance: 150,
        useWallet: true,
      });

      expect(result.totalAmount).toBe(100);
      expect(result.walletContribution).toBe(100);
      expect(result.gatewayAmount).toBe(0);
      expect(result.walletBalance).toBe(150);
      expect(result.canPayFullWithWallet).toBe(true);
      expect(result.coversEntireAmount).toBe(true);
    });

    it('Scenario B: wallet balance partially covers amount when enabled', () => {
      const result = calculatePaymentSplit({
        totalPayable: 100,
        walletBalance: 40,
        useWallet: true,
      });

      expect(result.totalAmount).toBe(100);
      expect(result.walletContribution).toBe(40);
      expect(result.gatewayAmount).toBe(60);
      expect(result.coversEntireAmount).toBe(false);
      expect(result.canPayFullWithWallet).toBe(false);
    });

    it('Scenario C: wallet payment disabled charges entire amount to gateway', () => {
      const result = calculatePaymentSplit({
        totalPayable: 100,
        walletBalance: 150,
        useWallet: false,
      });

      expect(result.totalAmount).toBe(100);
      expect(result.walletContribution).toBe(0);
      expect(result.gatewayAmount).toBe(100);
      expect(result.coversEntireAmount).toBe(false);
    });

    it('Scenario D: empty wallet charges entire amount to gateway', () => {
      const result = calculatePaymentSplit({
        totalPayable: 100,
        walletBalance: 0,
        useWallet: true,
      });

      expect(result.totalAmount).toBe(100);
      expect(result.walletContribution).toBe(0);
      expect(result.gatewayAmount).toBe(100);
      expect(result.coversEntireAmount).toBe(false);
    });

    it('Exact balance equals reservation amount', () => {
      const result = calculatePaymentSplit({
        totalPayable: 100,
        walletBalance: 100,
        useWallet: true,
      });

      expect(result.walletContribution).toBe(100);
      expect(result.gatewayAmount).toBe(0);
      expect(result.coversEntireAmount).toBe(true);
    });

    it('Rejects currency mismatch when wallet is enabled', () => {
      expect(() => {
        calculatePaymentSplit({
          totalPayable: 100,
          walletBalance: 100,
          useWallet: true,
          currency: 'IRR',
          walletCurrency: 'USD',
        });
      }).toThrow('Currency mismatch between wallet and reservation.');
    });

    it('Rejects invalid or negative totalPayable', () => {
      expect(() => {
        calculatePaymentSplit({
          totalPayable: 0,
          walletBalance: 100,
          useWallet: true,
        });
      }).toThrow('Invalid reservation payable amount for payment.');
    });
  });

  describe('2. Scenario A: Full Wallet Payment', () => {
    beforeEach(() => {
      state.customerAccounts.set(customerAccountId, {
        id: customerAccountId,
        walletBalance: 150000,
      });

      state.reservations.set(reservationId, {
        id: reservationId,
        gamingCenterId,
        customerAccountId,
        totalPrice: 100000,
        customerPayableAmount: 100000,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.UNPAID,
        stationSnapshot: { currency: 'IRR' },
      });
    });

    it('deducts full amount from wallet, updates reservation to PAID, and does not invoke gateway', async () => {
      const result = await PaymentsStation.initiatePayment({
        gamingCenterId,
        reservationId,
        idempotencyKey: 'idemp-full-1',
        useWallet: true,
        actor: { id: customerAccountId, actorType: SessionActorType.CUSTOMER } as any,
      });

      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
      expect(result.totalAmount).toBe(100000);
      expect(result.walletAmount).toBe(100000);
      expect(result.gatewayAmount).toBe(0);
      expect(result.checkoutUrl).toBeNull();

      // Verify wallet balance decremented
      const account = state.customerAccounts.get(customerAccountId);
      expect(account.walletBalance).toBe(50000);

      // Verify external provider was NOT called
      expect(mockProvider.initiatePayment).not.toHaveBeenCalled();

      // Verify reservation updated
      const res = state.reservations.get(reservationId);
      expect(res.paymentState).toBe(ReservationPaymentState.PAID);
      expect(res.status).toBe(ReservationStatus.CONFIRMED);

      // Verify wallet transaction created
      const wt = state.walletTransactions.find((t) => t.type === WalletTransactionType.RESERVATION_PAYMENT);
      expect(wt).toBeDefined();
      expect(wt.amount).toBe(-100000);
      expect(wt.paymentId).toBe(result.paymentId);

      // Verify ledger collection entry recorded
      const le = state.ledgerEntries.find((e) => e.paymentId === result.paymentId);
      expect(le).toBeDefined();
      expect(le.amount).toBe(100000);
    });
  });

  describe('3. Scenario B: Partial Wallet Payment + Gateway', () => {
    beforeEach(() => {
      state.customerAccounts.set(customerAccountId, {
        id: customerAccountId,
        walletBalance: 40000,
      });

      state.reservations.set(reservationId, {
        id: reservationId,
        gamingCenterId,
        customerAccountId,
        totalPrice: 100000,
        customerPayableAmount: 100000,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.UNPAID,
        stationSnapshot: { currency: 'IRR' },
      });
    });

    it('deducts wallet balance, initiates gateway for remaining amount, and completes on verify', async () => {
      // 1. Initiate partial payment
      const initResult = await PaymentsStation.initiatePayment({
        gamingCenterId,
        reservationId,
        idempotencyKey: 'idemp-part-1',
        useWallet: true,
        providerName: 'ZARINPAL',
        actor: { id: customerAccountId, actorType: SessionActorType.CUSTOMER } as any,
      });

      expect(initResult.paymentStatus).toBe(PaymentStatus.INITIATED);
      expect(initResult.totalAmount).toBe(100000);
      expect(initResult.walletAmount).toBe(40000);
      expect(initResult.gatewayAmount).toBe(60000);
      expect(initResult.checkoutUrl).toBe('https://gateway.example.com/pay/auth-12345');

      // Gateway called for only remaining 60000
      expect(mockProvider.initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 60000,
          currency: 'IRR',
        })
      );

      // Wallet deducted immediately
      const account = state.customerAccounts.get(customerAccountId);
      expect(account.walletBalance).toBe(0);

      // Reservation set to PENDING payment
      const resAfterInit = state.reservations.get(reservationId);
      expect(resAfterInit.paymentState).toBe(ReservationPaymentState.PENDING);

      // 2. Gateway verification callback succeeds
      const verifyResult = await PaymentsStation.verifyPayment({
        gamingCenterId,
        reservationId,
        authority: 'auth-12345',
        status: 'OK',
      });

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.paymentStatus).toBe(PaymentStatus.PAID);
      expect(verifyResult.totalAmount).toBe(100000);
      expect(verifyResult.walletAmount).toBe(40000);
      expect(verifyResult.gatewayAmount).toBe(60000);

      // Provider verify called for gateway amount (60000)
      expect(mockProvider.verifyPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          authority: 'auth-12345',
          amount: 60000,
        })
      );

      // Reservation marked PAID & CONFIRMED
      const resAfterVerify = state.reservations.get(reservationId);
      expect(resAfterVerify.paymentState).toBe(ReservationPaymentState.PAID);
      expect(resAfterVerify.status).toBe(ReservationStatus.CONFIRMED);

      // Total collected ledger entry recorded for full 100000
      const le = state.ledgerEntries.find((e) => e.paymentId === initResult.paymentId);
      expect(le).toBeDefined();
      expect(le.amount).toBe(100000);
    });
  });

  describe('4. Scenario C & D: Wallet Disabled or Empty', () => {
    it('Scenario C: does not deduct from wallet when useWallet is false', async () => {
      state.customerAccounts.set(customerAccountId, {
        id: customerAccountId,
        walletBalance: 150000,
      });

      state.reservations.set(reservationId, {
        id: reservationId,
        gamingCenterId,
        customerAccountId,
        totalPrice: 100000,
        customerPayableAmount: 100000,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.UNPAID,
      });

      const result = await PaymentsStation.initiatePayment({
        gamingCenterId,
        reservationId,
        idempotencyKey: 'idemp-c-1',
        useWallet: false,
      });

      expect(result.totalAmount).toBe(100000);
      expect(result.walletAmount).toBe(0);
      expect(result.gatewayAmount).toBe(100000);

      // Wallet remains 150000
      expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(150000);
      expect(state.walletTransactions.length).toBe(0);
      expect(mockProvider.initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100000,
        })
      );
    });

    it('Scenario D: empty wallet charges full amount to gateway without wallet transaction', async () => {
      state.customerAccounts.set(customerAccountId, {
        id: customerAccountId,
        walletBalance: 0,
      });

      state.reservations.set(reservationId, {
        id: reservationId,
        gamingCenterId,
        customerAccountId,
        totalPrice: 100000,
        customerPayableAmount: 100000,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.UNPAID,
      });

      const result = await PaymentsStation.initiatePayment({
        gamingCenterId,
        reservationId,
        idempotencyKey: 'idemp-d-1',
        useWallet: true,
        actor: { id: customerAccountId, actorType: SessionActorType.CUSTOMER } as any,
      });

      expect(result.totalAmount).toBe(100000);
      expect(result.walletAmount).toBe(0);
      expect(result.gatewayAmount).toBe(100000);

      expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(0);
      expect(state.walletTransactions.length).toBe(0);
    });
  });

  describe('5. Partial Payment Failure and Recovery', () => {
    beforeEach(() => {
      state.customerAccounts.set(customerAccountId, {
        id: customerAccountId,
        walletBalance: 40000,
      });

      state.reservations.set(reservationId, {
        id: reservationId,
        gamingCenterId,
        customerAccountId,
        totalPrice: 100000,
        customerPayableAmount: 100000,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.UNPAID,
      });
    });

    it('recovers wallet balance immediately if provider initiation throws an error', async () => {
      mockProvider.initiatePayment.mockRejectedValueOnce(new Error('Gateway connection timeout'));

      await expect(
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId,
          idempotencyKey: 'idemp-fail-init',
          useWallet: true,
          actor: { id: customerAccountId, actorType: SessionActorType.CUSTOMER } as any,
        })
      ).rejects.toThrow('Internal error during payment initiation.');

      // Wallet balance must be restored back to 40000
      const account = state.customerAccounts.get(customerAccountId);
      expect(account.walletBalance).toBe(40000);

      // Compensating REFUND transaction must exist
      const refundTx = state.walletTransactions.find((t) => t.type === WalletTransactionType.REFUND);
      expect(refundTx).toBeDefined();
      expect(refundTx.amount).toBe(40000);

      // Payment marked FAILED
      const payment = Array.from(state.payments.values())[0];
      expect(payment.status).toBe(PaymentStatus.FAILED);
    });

    it('recovers wallet balance idempotently on user cancellation / NOK callback', async () => {
      const initResult = await PaymentsStation.initiatePayment({
        gamingCenterId,
        reservationId,
        idempotencyKey: 'idemp-nok-1',
        useWallet: true,
        actor: { id: customerAccountId, actorType: SessionActorType.CUSTOMER } as any,
      });

      expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(0);

      // User cancels at gateway (NOK)
      const verifyResult = await PaymentsStation.verifyPayment({
        gamingCenterId,
        reservationId,
        authority: 'auth-12345',
        status: 'NOK',
      });

      expect(verifyResult.success).toBe(false);
      expect(verifyResult.paymentStatus).toBe(PaymentStatus.FAILED);

      // Wallet balance restored
      expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(40000);
      const refundTx = state.walletTransactions.filter((t) => t.type === WalletTransactionType.REFUND);
      expect(refundTx.length).toBe(1);

      // Duplicate NOK callback must not double-refund (Idempotency requirement)
      const verifyResult2 = await PaymentsStation.verifyPayment({
        gamingCenterId,
        reservationId,
        authority: 'auth-12345',
        status: 'NOK',
      });

      expect(verifyResult2.success).toBe(false);
      expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(40000);
      const refundTxAfterDup = state.walletTransactions.filter((t) => t.type === WalletTransactionType.REFUND);
      expect(refundTxAfterDup.length).toBe(1);
    });
  });

  describe('6. Security & Authorization Requirements', () => {
    beforeEach(() => {
      state.customerAccounts.set(customerAccountId, {
        id: customerAccountId,
        walletBalance: 150000,
      });

      state.reservations.set(reservationId, {
        id: reservationId,
        gamingCenterId,
        customerAccountId,
        totalPrice: 100000,
        customerPayableAmount: 100000,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.UNPAID,
      });
    });

    it('rejects payment if customer actor does not own the reservation', async () => {
      const otherCustomerActor: any = {
        id: 'cust-attacker',
        actorType: SessionActorType.CUSTOMER,
      };

      await expect(
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId,
          idempotencyKey: 'idemp-sec-1',
          useWallet: true,
          actor: otherCustomerActor,
        })
      ).rejects.toThrow('Unauthorized access to reservation payment.');
    });

    it('rejects calculate payment if customer actor does not own the reservation', async () => {
      const otherCustomerActor: any = {
        id: 'cust-attacker',
        actorType: SessionActorType.CUSTOMER,
      };

      await expect(
        PaymentsStation.calculatePayment({
          gamingCenterId,
          reservationId,
          useWallet: true,
          actor: otherCustomerActor,
        })
      ).rejects.toThrow('Unauthorized access to reservation payment.');
    });

    it('rejects payment for already paid reservation', async () => {
      state.reservations.get(reservationId).paymentState = ReservationPaymentState.PAID;

      await expect(
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId,
          idempotencyKey: 'idemp-paid',
          useWallet: true,
        })
      ).rejects.toThrow('Reservation is already paid.');
    });

    it('rejects payment for canceled or expired reservation', async () => {
      state.reservations.get(reservationId).status = ReservationStatus.CANCELED;

      await expect(
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId,
          idempotencyKey: 'idemp-canceled',
          useWallet: true,
        })
      ).rejects.toThrow('Reservation is canceled or expired and cannot be paid.');
    });
  });

  describe('7. Calculate Payment Endpoint Preview', () => {
    it('returns dynamic calculation breakdown without mutating database state', async () => {
      state.customerAccounts.set(customerAccountId, {
        id: customerAccountId,
        walletBalance: 35000,
      });

      state.reservations.set(reservationId, {
        id: reservationId,
        gamingCenterId,
        customerAccountId,
        totalPrice: 100000,
        customerPayableAmount: 100000,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.UNPAID,
      });

      const calculation = await PaymentsStation.calculatePayment({
        gamingCenterId,
        reservationId,
        useWallet: true,
        actor: { id: customerAccountId, actorType: SessionActorType.CUSTOMER } as any,
      });

      expect(calculation.totalAmount).toBe(100000);
      expect(calculation.walletBalance).toBe(35000);
      expect(calculation.walletContribution).toBe(35000);
      expect(calculation.gatewayAmount).toBe(65000);
      expect(calculation.useWallet).toBe(true);
      expect(calculation.coversEntireAmount).toBe(false);

      // Verify no changes made to state
      expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(35000);
      expect(state.payments.size).toBe(0);
      expect(state.walletTransactions.length).toBe(0);
    });
  });

  describe('8. Concurrency Protection & Race Conditions', () => {
    it('prevents double-spending when two concurrent requests try to spend the same wallet balance', async () => {
      // Customer has 100,000 in wallet
      state.customerAccounts.set(customerAccountId, {
        id: customerAccountId,
        walletBalance: 100000,
      });

      // Two different reservations each costing 80,000
      const res1 = 'res-race-1';
      const res2 = 'res-race-2';

      state.reservations.set(res1, {
        id: res1,
        gamingCenterId,
        customerAccountId,
        totalPrice: 80000,
        customerPayableAmount: 80000,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.UNPAID,
      });

      state.reservations.set(res2, {
        id: res2,
        gamingCenterId,
        customerAccountId,
        totalPrice: 80000,
        customerPayableAmount: 80000,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.UNPAID,
      });

      // Submit both full-wallet payment requests concurrently
      const ownerActor = { id: customerAccountId, actorType: SessionActorType.CUSTOMER } as any;
      const results = await Promise.allSettled([
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId: res1,
          idempotencyKey: 'race-idemp-1',
          useWallet: true,
          actor: ownerActor,
        }),
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId: res2,
          idempotencyKey: 'race-idemp-2',
          useWallet: true,
          actor: ownerActor,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one must succeed and one must fail with insufficient balance
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectedReason.message).toMatch(/Insufficient wallet balance/);

      // Remaining balance must be exactly 20,000 (never negative)
      const finalBalance = state.customerAccounts.get(customerAccountId).walletBalance;
      expect(finalBalance).toBe(20000);
    });
  });

  describe('9. Strict Idempotency & Retries', () => {
    it('re-requesting with same idempotencyKey returns existing payment without double deduction', async () => {
      state.customerAccounts.set(customerAccountId, {
        id: customerAccountId,
        walletBalance: 150000,
      });

      state.reservations.set(reservationId, {
        id: reservationId,
        gamingCenterId,
        customerAccountId,
        totalPrice: 100000,
        customerPayableAmount: 100000,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.UNPAID,
      });

      const ownerActor = { id: customerAccountId, actorType: SessionActorType.CUSTOMER } as any;

      // First call
      const firstResult = await PaymentsStation.initiatePayment({
        gamingCenterId,
        reservationId,
        idempotencyKey: 'dup-key-12345',
        useWallet: true,
        actor: ownerActor,
      });

      expect(firstResult.paymentStatus).toBe(PaymentStatus.PAID);
      expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(50000);

      // Second identical call (simulating retry or network replay)
      const secondResult = await PaymentsStation.initiatePayment({
        gamingCenterId,
        reservationId,
        idempotencyKey: 'dup-key-12345',
        useWallet: true,
        actor: ownerActor,
      });

      expect(secondResult.paymentId).toBe(firstResult.paymentId);
      expect(secondResult.paymentStatus).toBe(PaymentStatus.PAID);
      expect(secondResult.message).toBe('Payment already completed.');

      // Balance must NOT have been deducted again
      expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(50000);
      expect(state.walletTransactions.length).toBe(1);
    });

    it('retrying checkout when an active INITIATED payment exists cancels old payment and restores wallet balance', async () => {
      state.customerAccounts.set(customerAccountId, {
        id: customerAccountId,
        walletBalance: 40000,
      });

      state.reservations.set(reservationId, {
        id: reservationId,
        gamingCenterId,
        customerAccountId,
        totalPrice: 100000,
        customerPayableAmount: 100000,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.UNPAID,
      });

      const ownerActor = { id: customerAccountId, actorType: SessionActorType.CUSTOMER } as any;

      // 1. Initial attempt with partial wallet
      const firstResult = await PaymentsStation.initiatePayment({
        gamingCenterId,
        reservationId,
        idempotencyKey: 'first-attempt-key',
        useWallet: true,
        actor: ownerActor,
      });

      expect(firstResult.paymentStatus).toBe(PaymentStatus.INITIATED);
      expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(0);

      // 2. User abandons and initiates a new checkout (different idempotency key)
      const secondResult = await PaymentsStation.initiatePayment({
        gamingCenterId,
        reservationId,
        idempotencyKey: 'second-attempt-key',
        useWallet: true,
        actor: ownerActor,
      });

      // Old payment is cancelled and refunded, new payment deducted freshly
      expect(secondResult.paymentStatus).toBe(PaymentStatus.INITIATED);
      expect(secondResult.paymentId).not.toBe(firstResult.paymentId);

      const oldPayment = state.payments.get(firstResult.paymentId);
      expect(oldPayment.status).toBe(PaymentStatus.FAILED);

      // Wallet funds were restored from first payment then deducted for second payment
      expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(0);
      const refundTxs = state.walletTransactions.filter((t) => t.type === WalletTransactionType.REFUND);
      expect(refundTxs.length).toBe(1);
      expect(refundTxs[0].paymentId).toBe(firstResult.paymentId);
      expect(state.reservations.get(reservationId).status).toBe(ReservationStatus.PENDING);
    });

    it('re-verifying already FAILED payment returns failure without re-calling provider', async () => {
      const pId = 'pay-term-failed';
      state.payments.set(pId, {
        id: pId,
        gamingCenterId,
        reservationId,
        amount: 100000,
        walletAmount: 0,
        status: PaymentStatus.FAILED,
        providerPaymentId: 'term-auth-123',
        failureReason: 'Pre-existing failure',
        createdAt: new Date(),
      });

      const res = await PaymentsStation.verifyPayment({
        gamingCenterId,
        reservationId,
        authority: 'term-auth-123',
      });

      expect(res.success).toBe(false);
      expect(res.paymentStatus).toBe(PaymentStatus.FAILED);
      expect(mockProvider.verifyPayment).not.toHaveBeenCalled();
    });
  });

  describe('10. Prevent Unpaid/Failed Reservations on Payment Initiation Errors', () => {
    beforeEach(() => {
      state.customerAccounts.set(customerAccountId, {
        id: customerAccountId,
        walletBalance: 40000,
      });

      state.reservations.set(reservationId, {
        id: reservationId,
        gamingCenterId,
        customerAccountId,
        totalPrice: 100000,
        customerPayableAmount: 100000,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.UNPAID,
        stationSnapshot: { currency: 'IRR' },
      });
    });

    it('cancels reservation with paymentState FAILED when providerName=WALLET and wallet balance is insufficient', async () => {
      await expect(
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId,
          idempotencyKey: 'idemp-wallet-only-insuff',
          providerName: 'WALLET',
          actor: { id: customerAccountId, actorType: SessionActorType.CUSTOMER } as any,
        })
      ).rejects.toMatchObject({
        statusCode: httpStatus.BAD_REQUEST,
        code: 'INSUFFICIENT_WALLET_BALANCE',
      });

      expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(40000);
      const res = state.reservations.get(reservationId);
      expect(res.status).toBe(ReservationStatus.CANCELED);
      expect(res.paymentState).toBe(ReservationPaymentState.FAILED);
      expect(res.cancelCategory).toBe(CancellationCategory.PAYMENT_FAILED);
      expect(res.cancelActor).toBe(CancellationActor.SYSTEM);
    });

    it('cancels reservation with paymentState FAILED when PaymentProviderFactory.getProvider throws', async () => {
      (PaymentProviderFactory.getProvider as jest.Mock).mockImplementationOnce(() => {
        throw new AppError('Unsupported payment provider: BAD', httpStatus.BAD_REQUEST);
      });

      await expect(
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId,
          idempotencyKey: 'idemp-bad-provider',
          providerName: 'BAD',
          useWallet: false,
        })
      ).rejects.toThrow('Unsupported payment provider: BAD');

      const res = state.reservations.get(reservationId);
      expect(res.status).toBe(ReservationStatus.CANCELED);
      expect(res.paymentState).toBe(ReservationPaymentState.FAILED);
    });

    it('cancels reservation with paymentState FAILED without deducting wallet if createPartialPayment fails', async () => {
      const spy = jest.spyOn(PaymentsRepo, 'createPartialPayment').mockRejectedValueOnce(
        new AppError('Insufficient wallet balance.', httpStatus.BAD_REQUEST, {
          code: 'INSUFFICIENT_WALLET_BALANCE',
        })
      );

      await expect(
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId,
          idempotencyKey: 'idemp-partial-fail',
          useWallet: true,
          actor: { id: customerAccountId, actorType: SessionActorType.CUSTOMER } as any,
        })
      ).rejects.toThrow('Insufficient wallet balance.');

      spy.mockRestore();
      expect(state.customerAccounts.get(customerAccountId).walletBalance).toBe(40000);
      const res = state.reservations.get(reservationId);
      expect(res.status).toBe(ReservationStatus.CANCELED);
      expect(res.paymentState).toBe(ReservationPaymentState.FAILED);
    });

    it('cancels reservation with paymentState FAILED if createPaymentAndUpdateReservation fails', async () => {
      const spy = jest.spyOn(PaymentsRepo, 'createPaymentAndUpdateReservation').mockRejectedValueOnce(
        new Error('DB write conflict')
      );

      await expect(
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId,
          idempotencyKey: 'idemp-gw-create-fail',
          useWallet: false,
        })
      ).rejects.toThrow('DB write conflict');

      spy.mockRestore();
      const res = state.reservations.get(reservationId);
      expect(res.status).toBe(ReservationStatus.CANCELED);
      expect(res.paymentState).toBe(ReservationPaymentState.FAILED);
    });

    it('rejects initiatePayment for reservation whose paymentState is already FAILED or CANCELED', async () => {
      state.reservations.get(reservationId).paymentState = ReservationPaymentState.FAILED;

      await expect(
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId,
          idempotencyKey: 'idemp-already-failed',
          useWallet: true,
        })
      ).rejects.toThrow('Reservation payment has already failed or been canceled.');

      state.reservations.get(reservationId).paymentState = ReservationPaymentState.CANCELED;

      await expect(
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId,
          idempotencyKey: 'idemp-already-canceled-pay',
          useWallet: true,
        })
      ).rejects.toThrow('Reservation payment has already failed or been canceled.');
    });

    it('does not cancel an already-PAID reservation if concurrent createFullWalletPayment throws already paid', async () => {
      state.customerAccounts.set(customerAccountId, {
        id: customerAccountId,
        walletBalance: 200000,
      });
      state.reservations.set(reservationId, {
        id: reservationId,
        gamingCenterId,
        customerAccountId,
        totalPrice: 100000,
        customerPayableAmount: 100000,
        status: ReservationStatus.CONFIRMED,
        paymentState: ReservationPaymentState.UNPAID,
        stationSnapshot: { currency: 'IRR' },
      });

      const spy = jest.spyOn(PaymentsRepo, 'createFullWalletPayment').mockImplementationOnce(async () => {
        const res = state.reservations.get(reservationId);
        res.paymentState = ReservationPaymentState.PAID;
        res.status = ReservationStatus.CONFIRMED;
        throw new AppError('Reservation is already paid.', httpStatus.CONFLICT);
      });

      await expect(
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId,
          idempotencyKey: 'idemp-race-paid',
          useWallet: true,
          actor: { id: customerAccountId, actorType: SessionActorType.CUSTOMER } as any,
        })
      ).rejects.toThrow('Reservation is already paid.');

      spy.mockRestore();
      const res = state.reservations.get(reservationId);
      expect(res.status).toBe(ReservationStatus.CONFIRMED);
      expect(res.paymentState).toBe(ReservationPaymentState.PAID);
    });
  });
});
