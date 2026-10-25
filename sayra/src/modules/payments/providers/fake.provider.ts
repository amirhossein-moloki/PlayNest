import { PaymentStatus } from '@prisma/client';
import {
  IPaymentProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
} from './payment-provider.interface';

export class FakePaymentProvider implements IPaymentProvider {
  readonly name = 'FAKE';

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
}
