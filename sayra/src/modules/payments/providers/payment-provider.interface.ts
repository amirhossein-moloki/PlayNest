import { PaymentStatus } from '@prisma/client';

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

export interface IPaymentProvider {
  readonly name: string;
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult>;
}
