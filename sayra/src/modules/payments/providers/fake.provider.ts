import { PaymentStatus, RefundStatus } from '@prisma/client';
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

export class FakePaymentProvider implements IPaymentProvider {
  readonly name = 'FAKE';
  readonly supportsRefunds = true;

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const mockAuthority = `FAKE_AUTH_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      providerPaymentId: mockAuthority,
      checkoutUrl: `https://fake-payment.local/checkout?authority=${mockAuthority}&amount=${params.amount}`,
      rawPayload: { authority: mockAuthority, status: 'INITIATED' },
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    if (params.authority.includes('FAIL')) {
      return {
        success: false,
        status: PaymentStatus.FAILED,
        failureReason: 'Fake provider simulated payment failure',
        rawPayload: { authority: params.authority, verified: false },
      };
    }

    const mockRefId = `FAKE_REF_${Date.now()}`;
    return {
      success: true,
      status: PaymentStatus.PAID,
      refId: mockRefId,
      rawPayload: { authority: params.authority, refId: mockRefId, verified: true },
    };
  }

  async requestRefund(params: RequestRefundParams): Promise<RequestRefundResult> {
    const reasonUpper = (params.reason || '').toUpperCase();
    const providerPaymentIdUpper = (params.providerPaymentId || '').toUpperCase();

    if (reasonUpper.includes('FAIL') || providerPaymentIdUpper.includes('FAIL')) {
      return {
        success: false,
        status: RefundStatus.FAILED,
        failureReason: 'Fake provider simulated refund rejection',
        rawPayload: { refundRequested: false, reason: params.reason },
      };
    }

    if (reasonUpper.includes('AMBIGUOUS')) {
      return {
        success: false,
        status: RefundStatus.AMBIGUOUS,
        failureReason: 'Fake provider outcome ambiguous / pending manual check',
        rawPayload: { refundRequested: true, ambiguous: true },
      };
    }

    if (reasonUpper.includes('PENDING')) {
      return {
        success: false,
        status: RefundStatus.PENDING,
        failureReason: 'Fake provider processing refund asynchronously',
        rawPayload: { refundRequested: true, pending: true },
      };
    }

    const mockRefundId = `FAKE_REFUND_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return {
      success: true,
      status: RefundStatus.SUCCESSFUL,
      providerRefundId: mockRefundId,
      rawPayload: { providerRefundId: mockRefundId, amount: params.amount, status: 'COMPLETED' },
    };
  }

  async verifyRefund(params: VerifyRefundParams): Promise<VerifyRefundResult> {
    const refundIdUpper = (params.providerRefundId || params.refundId).toUpperCase();

    if (refundIdUpper.includes('FAIL')) {
      return {
        success: false,
        status: RefundStatus.FAILED,
        failureReason: 'Fake provider verified refund failure',
      };
    }

    if (refundIdUpper.includes('AMBIGUOUS')) {
      return {
        success: false,
        status: RefundStatus.AMBIGUOUS,
        failureReason: 'Fake provider refund outcome remains ambiguous',
      };
    }

    return {
      success: true,
      status: RefundStatus.SUCCESSFUL,
      providerRefundId: params.providerRefundId || `FAKE_REFUND_${params.refundId}`,
    };
  }
}
