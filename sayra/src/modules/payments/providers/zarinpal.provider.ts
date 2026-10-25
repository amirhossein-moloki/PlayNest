import { PaymentStatus, RefundStatus } from '@prisma/client';
import AppError from '../../../common/errors/AppError';
import httpStatus from 'http-status';
import { env } from '../../../config/env';
import {
  IPaymentProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
  RequestRefundParams,
  RequestRefundResult,
  VerifyRefundParams,
  VerifyRefundResult,
} from './payment-provider.interface';

export class ZarinPalProvider implements IPaymentProvider {
  readonly name = 'ZARINPAL';
  readonly supportsRefunds = false;

  private getBaseUrls() {
    const isSandbox = env.ZARINPAL_SANDBOX;
    return {
      apiUrl: isSandbox ? 'https://sandbox.zarinpal.com/pg/v4' : 'https://api.zarinpal.com/pg/v4',
      startPayUrl: isSandbox ? 'https://sandbox.zarinpal.com/pg/StartPay' : 'https://www.zarinpal.com/pg/StartPay',
    };
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const { apiUrl, startPayUrl } = this.getBaseUrls();

    try {
      const response = await fetch(`${apiUrl}/payment/request.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: env.ZARINPAL_MERCHANT_ID,
          amount: params.amount,
          callback_url: params.callbackUrl,
          description: params.description,
          metadata: {
            reservationId: params.reservationId,
            gamingCenterId: params.gamingCenterId,
            ...params.metadata,
          },
        }),
      });

      const result = (await response.json()) as {
        data?: { authority: string; code: number; message: string; fee_type: string; fee: number };
        errors?: Record<string, unknown> | Array<unknown>;
      };

      if (result.errors && (Array.isArray(result.errors) ? result.errors.length > 0 : Object.keys(result.errors).length > 0)) {
        console.error('ZarinPal Error:', result.errors);
        throw new AppError('Payment initiation failed with provider.', httpStatus.BAD_GATEWAY);
      }

      if (!result.data || !result.data.authority) {
        console.error('ZarinPal Invalid Response:', result);
        throw new AppError('Invalid response from payment provider.', httpStatus.BAD_GATEWAY);
      }

      const authority = result.data.authority;

      return {
        providerPaymentId: authority,
        checkoutUrl: `${startPayUrl}/${authority}`,
        rawPayload: result,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Payment initiation error:', error);
      throw new AppError('Internal error during payment initiation.', httpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const { apiUrl } = this.getBaseUrls();

    try {
      const response = await fetch(`${apiUrl}/payment/verify.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: env.ZARINPAL_MERCHANT_ID,
          amount: params.amount,
          authority: params.authority,
        }),
      });

      const result = (await response.json()) as {
        data?: { code: number; ref_id: number | string; card_pan?: string; card_hash?: string; fee_type?: string; fee?: number };
        errors?: Record<string, unknown> | Array<unknown>;
      };

      if (result.data && (result.data.code === 100 || result.data.code === 101)) {
        return {
          success: true,
          status: PaymentStatus.PAID,
          refId: String(result.data.ref_id),
          rawPayload: result,
        };
      }

      const errorMessage =
        result.errors && typeof result.errors === 'object'
          ? JSON.stringify(result.errors)
          : 'Payment verification failed with provider.';

      return {
        success: false,
        status: PaymentStatus.FAILED,
        failureReason: errorMessage,
        rawPayload: result,
      };
    } catch (error) {
      console.error('ZarinPal verify exception:', error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        failureReason: error instanceof Error ? error.message : 'Unknown verification error',
      };
    }
  }

  async requestRefund(_params: RequestRefundParams): Promise<RequestRefundResult> {
    return {
      success: false,
      status: RefundStatus.FAILED,
      failureReason: 'ZarinPal API v4 does not support direct automated refunds; manual panel refund is required.',
    };
  }

  async verifyRefund(_params: VerifyRefundParams): Promise<VerifyRefundResult> {
    return {
      success: false,
      status: RefundStatus.FAILED,
      failureReason: 'ZarinPal API v4 does not support direct automated refund verification.',
    };
  }
}
