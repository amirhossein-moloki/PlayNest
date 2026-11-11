import { WalletChargeStatus, PaymentProvider } from '@prisma/client';
import { WalletChargeRepo } from './charge.repo';
import { PaymentProviderFactory } from '../payments/providers';
import { env } from '../../config/env';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import logger from '../../config/logger';

export interface InitiateWalletChargeInput {
  customerAccountId: string;
  amount: number;
  currency?: string; // 'IRT' (default) or 'IRR'
  idempotencyKey?: string | null;
}

export interface VerifyWalletChargeInput {
  trackId: string;
  orderId?: string;
  statusQuery?: string | number;
  successQuery?: string | number;
}

const MIN_CHARGE_AMOUNT_TOMAN = 1000; // 1,000 Tomans
const MAX_CHARGE_AMOUNT_TOMAN = 50_000_000; // 50,000,000 Tomans (500,000,000 IRR)

export const WalletChargeStation = {
  /**
   * Convert currency and amounts safely:
   * Backend authoritative currency is IRR.
   * If currency is IRT (or undefined, default), multiply by 10 to get IRR.
   */
  normalizeAmountToRials(amount: number, currency = 'IRT'): { amountRials: number; currency: string } {
    if (!amount || typeof amount !== 'number' || !Number.isFinite(amount) || !Number.isInteger(amount)) {
      throw new AppError('Charge amount must be a positive integer', httpStatus.BAD_REQUEST);
    }

    const currUpper = currency.toUpperCase();
    if (currUpper !== 'IRT' && currUpper !== 'IRR' && currUpper !== 'TOMAN' && currUpper !== 'TOMANS') {
      throw new AppError('Currency must be IRT or IRR', httpStatus.BAD_REQUEST);
    }

    let amountRials: number;
    if (currUpper === 'IRR') {
      amountRials = amount;
    } else {
      amountRials = amount * 10;
    }

    const amountInTomans = currUpper === 'IRR' ? Math.floor(amount / 10) : amount;
    if (amountInTomans < MIN_CHARGE_AMOUNT_TOMAN) {
      throw new AppError(
        `Minimum wallet charge amount is ${MIN_CHARGE_AMOUNT_TOMAN.toLocaleString('fa-IR')} Tomans (${(MIN_CHARGE_AMOUNT_TOMAN * 10).toLocaleString('fa-IR')} Rials)`,
        httpStatus.BAD_REQUEST
      );
    }

    if (amountInTomans > MAX_CHARGE_AMOUNT_TOMAN) {
      throw new AppError(
        `Maximum wallet charge amount is ${MAX_CHARGE_AMOUNT_TOMAN.toLocaleString('fa-IR')} Tomans (${(MAX_CHARGE_AMOUNT_TOMAN * 10).toLocaleString('fa-IR')} Rials)`,
        httpStatus.BAD_REQUEST
      );
    }

    return {
      amountRials,
      currency: 'IRR',
    };
  },

  /**
   * Initiates an online wallet recharge with Zibal gateway.
   */
  async initiateCharge(input: InitiateWalletChargeInput) {
    const { customerAccountId, amount, currency = 'IRT', idempotencyKey } = input;

    const { amountRials } = this.normalizeAmountToRials(amount, currency);

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = await WalletChargeRepo.findChargeByIdempotencyKey(customerAccountId, idempotencyKey);
      if (existing) {
        if (existing.status === WalletChargeStatus.PENDING && existing.trackId) {
          const checkoutUrl = `https://gateway.zibal.ir/start/${existing.trackId}`;
          return {
            chargeId: existing.id,
            trackId: existing.trackId,
            paymentUrl: checkoutUrl,
            amount: existing.amount,
            currency: existing.currency,
            status: existing.status,
            replayed: true,
          };
        } else if (existing.status === WalletChargeStatus.PAID) {
          return {
            chargeId: existing.id,
            trackId: existing.trackId,
            paymentUrl: null,
            amount: existing.amount,
            currency: existing.currency,
            status: existing.status,
            replayed: true,
          };
        }
      }
    }

    // 2. Create durable WalletCharge record
    const charge = await WalletChargeRepo.createCharge({
      customerAccountId,
      amount: amountRials,
      currency: 'IRR',
      provider: PaymentProvider.ZIBAL,
      status: WalletChargeStatus.PENDING,
      idempotencyKey: idempotencyKey || null,
    });

    // 3. Initiate payment with Zibal Provider
    try {
      const provider = PaymentProviderFactory.getProvider('ZIBAL');
      // Construct wallet dedicated callback URL or standard callback URL
      const callbackUrl = `${env.ZIBAL_CALLBACK_URL.replace(/\/zibal\/callback\/?$/, '')}/zibal/wallet/callback`;

      const initiateResult = await provider.initiatePayment({
        amount: amountRials,
        currency: 'IRR',
        description: `Wallet Recharge ${charge.id}`,
        callbackUrl,
        reservationId: charge.id, // Passes charge.id as orderId in Zibal request
      });

      const trackId = initiateResult.providerPaymentId;
      const checkoutUrl = initiateResult.checkoutUrl;

      // Update charge with trackId
      await WalletChargeRepo.updateCharge(charge.id, {
        trackId,
        rawProviderPayload: initiateResult.rawPayload as import('@prisma/client').Prisma.InputJsonValue,
      });

      return {
        chargeId: charge.id,
        trackId,
        paymentUrl: checkoutUrl,
        amount: amountRials,
        currency: 'IRR',
        status: WalletChargeStatus.PENDING,
      };
    } catch (error) {
      await WalletChargeRepo.updateCharge(charge.id, {
        status: WalletChargeStatus.FAILED,
        failureReason: error instanceof Error ? error.message : 'Zibal initiation failed',
      });
      logger.error({ error, chargeId: charge.id }, 'Failed to initiate wallet charge with Zibal');
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to initiate wallet payment gateway. Please try again.', httpStatus.BAD_GATEWAY);
    }
  },

  /**
   * Verifies a wallet charge from Zibal callback server-to-server.
   */
  async verifyCharge(input: VerifyWalletChargeInput) {
    const { trackId, orderId, statusQuery, successQuery } = input;

    // 1. Locate durable record by trackId or orderId
    let charge = trackId ? await WalletChargeRepo.findChargeByTrackId(trackId) : null;
    if (!charge && orderId) {
      charge = await WalletChargeRepo.findChargeById(orderId);
    }

    if (!charge) {
      logger.warn({ trackId, orderId }, 'Wallet Charge Callback: Charge record not found');
      return {
        success: false,
        charge: null,
        failureReason: 'تراکنش شارژ کیف پول در سیستم یافت نشد.',
      };
    }

    // 2. Idempotency Check: If already PAID, return success without re-crediting
    if (charge.status === WalletChargeStatus.PAID) {
      return {
        success: true,
        charge,
        alreadyProcessed: true,
        refNumber: charge.refNumber,
      };
    }

    // 3. Preliminary gateway return check
    const isFailedStatus =
      (statusQuery !== undefined && Number(statusQuery) !== 1 && Number(statusQuery) !== 2) ||
      successQuery === '0' ||
      successQuery === 'false';

    if (isFailedStatus) {
      await WalletChargeRepo.updateCharge(charge.id, {
        status: WalletChargeStatus.CANCELLED,
        failureReason: `Gateway callback unfulfilled: status=${statusQuery}, success=${successQuery}`,
      });

      return {
        success: false,
        charge,
        failureReason: 'پرداخت در درگاه بانکی لغو شد یا با خطا متوقف گردید.',
      };
    }

    // 4. Server-to-server authoritative verify call using Zibal Provider
    const provider = PaymentProviderFactory.getProvider('ZIBAL');
    const verifyResult = await provider.verifyPayment({
      authority: trackId || charge.trackId!,
      amount: charge.amount,
      metadata: {
        orderId: charge.id,
        paymentId: charge.id,
      },
    });

    if (!verifyResult.success) {
      await WalletChargeRepo.updateCharge(charge.id, {
        status: WalletChargeStatus.FAILED,
        failureReason: verifyResult.failureReason || 'تأییدیه نهایی توسط زیبال صادر نشد.',
      });

      return {
        success: false,
        charge,
        failureReason: verifyResult.failureReason || 'تأییدیه پرداخت توسط درگاه زیبال رد شد.',
      };
    }

    // 5. Atomic execution of wallet balance credit and transaction record
    try {
      const creditedCharge = await WalletChargeRepo.executeAtomicCredit(
        charge.id,
        verifyResult.refId,
        verifyResult.rawPayload as import('@prisma/client').Prisma.InputJsonValue
      );

      return {
        success: true,
        charge: creditedCharge,
        refNumber: verifyResult.refId,
      };
    } catch (error) {
      logger.error({ error, chargeId: charge.id }, 'Error executing atomic credit for wallet charge');
      throw error;
    }
  },

  /**
   * Get charge status with ownership check
   */
  async getChargeStatus(chargeId: string, customerAccountId: string) {
    const charge = await WalletChargeRepo.findChargeByIdAndCustomer(chargeId, customerAccountId);
    if (!charge) {
      throw new AppError('Wallet charge transaction not found', httpStatus.NOT_FOUND);
    }

    return {
      id: charge.id,
      customerAccountId: charge.customerAccountId,
      amount: charge.amount,
      currency: charge.currency,
      provider: charge.provider,
      status: charge.status,
      trackId: charge.trackId,
      refNumber: charge.refNumber,
      failureReason: charge.failureReason,
      paidAt: charge.paidAt,
      createdAt: charge.createdAt,
      updatedAt: charge.updatedAt,
    };
  },
};
