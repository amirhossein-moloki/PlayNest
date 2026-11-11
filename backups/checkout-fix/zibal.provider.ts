import { PaymentStatus, RefundStatus } from '@prisma/client';
import Zibal from 'zibal';
import AppError from '../../../common/errors/AppError';
import httpStatus from 'http-status';
import { env } from '../../../config/env';
import { zibalClient } from './zibal.client';
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

const {
  ZibalValidationError,
  ZibalApiError,
  ZibalNetworkError,
  ZibalTimeoutError,
  ZibalAbortError,
  ZibalHttpError,
  ZibalResponseError,
  ZibalIntegrityError,
} = Zibal.errors;

export class ZibalProvider implements IPaymentProvider {
  readonly name = 'ZIBAL';
  readonly supportsRefunds = false;

  private client: Zibal;

  constructor(clientInstance?: Zibal) {
    this.client = clientInstance || zibalClient;
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    try {
      const response = await this.client.request({
        amount: params.amount,
        orderId: params.reservationId,
        callbackUrl: params.callbackUrl || env.ZIBAL_CALLBACK_URL,
        description: params.description,
      });

      return {
        providerPaymentId: String(response.trackId),
        checkoutUrl: response.paymentUrl,
        rawPayload: response,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof ZibalValidationError) {
        console.error('Zibal validation error:', error.message, error.details);
        throw new AppError(`Payment request validation failed: ${error.message}`, httpStatus.BAD_REQUEST);
      }

      if (error instanceof ZibalApiError) {
        console.error('Zibal API error:', error.code, error.message);
        throw new AppError('Payment initiation rejected by provider.', httpStatus.BAD_GATEWAY);
      }

      if (error instanceof ZibalTimeoutError) {
        console.error('Zibal timeout error:', error.message);
        throw new AppError('Payment provider request timed out. Please try again.', httpStatus.GATEWAY_TIMEOUT);
      }

      if (error instanceof ZibalNetworkError || error instanceof ZibalAbortError) {
        console.error('Zibal network error:', error.message);
        throw new AppError('Network error connecting to payment provider.', httpStatus.BAD_GATEWAY);
      }

      if (error instanceof ZibalHttpError || error instanceof ZibalResponseError) {
        console.error('Zibal HTTP/response error:', error.message);
        throw new AppError('Invalid response from payment provider.', httpStatus.BAD_GATEWAY);
      }

      console.error('Zibal payment initiation unexpected error:', error);
      throw new AppError('Internal error during payment initiation.', httpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const orderId = (params.metadata?.orderId || params.metadata?.reservationId) as string | number | undefined;

    try {
      const response = await this.client.verify({
        trackId: params.authority,
        expectedAmount: params.amount,
        expectedOrderId: orderId,
      });

      return {
        success: true,
        status: PaymentStatus.PAID,
        refId: response.refNumber ? String(response.refNumber) : undefined,
        rawPayload: response,
      };
    } catch (error) {
      if (error instanceof ZibalIntegrityError) {
        console.error('Zibal integrity mismatch error:', error.message);
        return {
          success: false,
          status: PaymentStatus.FAILED,
          failureReason: 'Payment integrity check failed: amount or orderId mismatch.',
        };
      }

      if (error instanceof ZibalApiError) {
        console.error('Zibal API verification error:', error.code, error.message);
        return {
          success: false,
          status: PaymentStatus.FAILED,
          failureReason: error.message || 'Payment verification failed with provider.',
        };
      }

      if (error instanceof ZibalTimeoutError) {
        console.error('Zibal verification timeout:', error.message);
        return {
          success: false,
          status: PaymentStatus.FAILED,
          failureReason: 'Payment verification timed out.',
        };
      }

      if (error instanceof ZibalNetworkError || error instanceof ZibalAbortError) {
        console.error('Zibal verification network error:', error.message);
        return {
          success: false,
          status: PaymentStatus.FAILED,
          failureReason: 'Payment verification network error.',
        };
      }

      console.error('Zibal verification unexpected error:', error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        failureReason: error instanceof Error ? error.message : 'Unknown verification error',
      };
    }
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async requestRefund(_params?: RequestRefundParams): Promise<RequestRefundResult> {
    return {
      success: false,
      status: RefundStatus.FAILED,
      failureReason: 'Zibal does not support direct automated refunds; manual panel refund is required.',
    };
  }

  async verifyRefund(_params?: VerifyRefundParams): Promise<VerifyRefundResult> {
    return {
      success: false,
      status: RefundStatus.FAILED,
      failureReason: 'Zibal does not support direct automated refund verification.',
    };
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
