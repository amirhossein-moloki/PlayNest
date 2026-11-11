import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { handlePaymentCallback, handleZibalCallback, handleZibalWalletCallback } from './payments.callback.controller';

const router = Router();

// General payment gateway public callback (ZarinPal, etc. browser return)
router.get('/callback', asyncHandler(handlePaymentCallback));
router.post('/callback', asyncHandler(handlePaymentCallback));
router.get('/zarinpal/callback', asyncHandler(handlePaymentCallback));
router.post('/zarinpal/callback', asyncHandler(handlePaymentCallback));

// Dedicated Zibal wallet charge callback
router.get('/zibal/wallet/callback', asyncHandler(handleZibalWalletCallback));
router.post('/zibal/wallet/callback', asyncHandler(handleZibalWalletCallback));

// Zibal gateway public callback (browser redirect)
router.get('/zibal/callback', asyncHandler(handleZibalCallback));
router.post('/zibal/callback', asyncHandler(handleZibalCallback));

export const paymentsCallbackRouter = router;
