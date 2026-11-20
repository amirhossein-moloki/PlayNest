import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export interface PaymentSplitResult {
  totalAmount: number;
  walletContribution: number;
  gatewayAmount: number;
  walletBalance: number;
  useWallet: boolean;
  canPayFullWithWallet: boolean;
  coversEntireAmount: boolean;
  currency: string;
}

/**
 * Calculates the exact financial split between customer wallet and external payment gateway.
 *
 * Rules:
 * 1. totalAmount = Math.round(totalPayable) (integer, strictly positive)
 * 2. availableWalletBalance = Math.max(0, Math.floor(walletBalance || 0))
 * 3. If useWallet is true:
 *      walletContribution = Math.min(availableWalletBalance, totalAmount)
 *    Otherwise:
 *      walletContribution = 0
 * 4. gatewayAmount = totalAmount - walletContribution
 * 5. Rejects currency mismatch between wallet and reservation.
 * 6. Guarantees amounts are non-negative integers and no floating-point rounding errors.
 */
export function calculatePaymentSplit(params: {
  totalPayable?: number;
  payableAmount?: number;
  walletBalance: number;
  useWallet?: boolean;
  currency?: string;
  walletCurrency?: string;
}): PaymentSplitResult {
  const amountToUse = params.payableAmount ?? params.totalPayable ?? 0;
  const totalAmount = Math.round(amountToUse);
  if (isNaN(totalAmount) || totalAmount <= 0) {
    throw new AppError('Invalid reservation payable amount for payment.', httpStatus.BAD_REQUEST);
  }

  const currency = params.currency || 'IRR';
  const walletCurrency = params.walletCurrency || 'IRR';

  if (params.useWallet && currency !== walletCurrency) {
    throw new AppError('Currency mismatch between wallet and reservation.', httpStatus.BAD_REQUEST);
  }

  const rawWalletBalance = Math.floor(params.walletBalance || 0);
  const availableWalletBalance = Math.max(0, rawWalletBalance);

  let walletContribution = 0;
  if (params.useWallet === true && availableWalletBalance > 0) {
    walletContribution = Math.min(availableWalletBalance, totalAmount);
  }

  const gatewayAmount = totalAmount - walletContribution;
  const canPayFullWithWallet = availableWalletBalance >= totalAmount;
  const coversEntireAmount = Boolean(params.useWallet) && canPayFullWithWallet;

  return {
    totalAmount,
    walletContribution,
    gatewayAmount,
    walletBalance: availableWalletBalance,
    useWallet: !!params.useWallet,
    canPayFullWithWallet,
    coversEntireAmount,
    currency,
  };
}
