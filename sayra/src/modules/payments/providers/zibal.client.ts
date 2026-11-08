import Zibal from 'zibal';
import { env } from '../../../config/env';

const merchant = env.ZIBAL_MERCHANT;

if (!merchant) {
  throw new Error('ZIBAL_MERCHANT is required');
}

export const zibalClient = new Zibal({
  merchant,
  callbackUrl: env.ZIBAL_CALLBACK_URL,
  timeout: 10000,
});
