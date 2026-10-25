import { PaymentStatus, RefundStatus } from '@prisma/client';

export interface InitiatePaymentParams {
  amount: number;
  currency: string;
  description: string;
  callbackUrl: string;
  reservationId: string;
  gamingCenterId: string;
  metadata?: Record<string, unknown>;
}

export interface InitiatePaymentResult {
  providerPaymentId: string;
  providerCheckoutId?: string;
  checkoutUrl: string;
  rawPayload?: unknown;
}

export interface VerifyPaymentParams {
  authority: string;
  amount: number;
  metadata?: Record<string, unknown>;
}

export interface VerifyPaymentResult {
  success: boolean;
  status: PaymentStatus;
  refId?: string;
  failureReason?: string;
  rawPayload?: unknown;
}

export interface RequestRefundParams {
  paymentId: string;
  providerPaymentId?: string;
  amount: number;
  currency: string;
  reason?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface RequestRefundResult {
  success: boolean;
  status: RefundStatus;
  providerRefundId?: string;
  failureReason?: string;
  rawPayload?: unknown;
}

export interface VerifyRefundParams {
  refundId: string;
  providerRefundId?: string;
  providerPaymentId?: string;
  amount: number;
  currency: string;
}

export interface VerifyRefundResult {
  success: boolean;
  status: RefundStatus;
  providerRefundId?: string;
  failureReason?: string;
  rawPayload?: unknown;
}

export interface IPaymentProvider {
  readonly name: string;
  readonly supportsRefunds: boolean;
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult>;
  requestRefund?(params: RequestRefundParams): Promise<RequestRefundResult>;
  verifyRefund?(params: VerifyRefundParams): Promise<VerifyRefundResult>;
}
