import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { WalletRepo } from '../../../../src/modules/wallet/wallet.repo';
import { PaymentStatus, WalletTransactionType } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('WalletRepo', () => {
  const accountMock = prismaMock.customerAccount /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const transMock = prismaMock.walletTransaction /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const paymentMock = prismaMock.payment /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const resMock = prismaMock.reservation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  describe('updateBalance', () => {
    it('should increment wallet balance', async () => {
      accountMock.update.mockResolvedValue({ id: 'ca-1', walletBalance: 1000 });
      const result = await WalletRepo.updateBalance('ca-1', 500);
      expect(accountMock.update).toHaveBeenCalledWith({
        where: { id: 'ca-1' },
        data: { walletBalance: { increment: 500 } }
      });
      expect(result.walletBalance).toBe(1000);
    });
  });

  describe('createTransaction', () => {
    it('should create a wallet transaction', async () => {
      const data = {
        customerAccountId: 'ca-1',
        amount: 500,
        currency: 'IRR',
        type: WalletTransactionType.DEPOSIT
      };
      transMock.create.mockResolvedValue({ id: 't-1', ...data });
      const result = await WalletRepo.createTransaction(data);
      expect(transMock.create).toHaveBeenCalledWith({ data });
      expect(result.id).toBe('t-1');
    });
  });

  describe('findTotalPaidForBooking', () => {
    it('should sum up paid payments for a reservation', async () => {
      paymentMock.findMany.mockResolvedValue([
        { amount: 100 },
        { amount: 200 }
      ]);
      const total = await WalletRepo.findTotalPaidForBooking('res-1');
      expect(total).toBe(300);
      expect(paymentMock.findMany).toHaveBeenCalledWith({
        where: { reservationId: 'res-1', status: PaymentStatus.PAID }
      });
    });

    it('should return 0 if no payments found', async () => {
      paymentMock.findMany.mockResolvedValue([]);
      const total = await WalletRepo.findTotalPaidForBooking('res-1');
      expect(total).toBe(0);
    });
  });

  describe('findBooking', () => {
    it('should find reservation with customer account', async () => {
      resMock.findUnique.mockResolvedValue({ id: 'res-1', customerAccount: { id: 'ca-1' } });
      const result = await WalletRepo.findBooking('res-1');
      expect(result.customerAccount.id).toBe('ca-1');
      expect(resMock.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'res-1' },
        include: { customerAccount: true }
      }));
    });
  });
});
