import { env } from '../../../config/env';
import AppError from '../../../common/errors/AppError';
import httpStatus from 'http-status';
import { IPaymentProvider } from './payment-provider.interface';
import { ZarinPalProvider } from './zarinpal.provider';
import { FakePaymentProvider } from './fake.provider';

export class PaymentProviderFactory {
  static getProvider(requestedProvider?: string): IPaymentProvider {
    const providerName = (requestedProvider || env.DEFAULT_PAYMENT_PROVIDER || 'ZARINPAL').toUpperCase();

    if (providerName === 'ZARINPAL') {
      return new ZarinPalProvider();
    }

    if (providerName === 'FAKE') {
      if (env.NODE_ENV === 'production') {
        throw new AppError('Fake payment provider is disabled in production.', httpStatus.FORBIDDEN);
      }
      return new FakePaymentProvider();
    }

    throw new AppError(`Unsupported payment provider: ${providerName}`, httpStatus.BAD_REQUEST);
  }
}
