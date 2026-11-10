import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { handlePaymentCallback, handleZibalCallback } from './payments.callback.controller';

const router = Router();

// General payment gateway public callback (ZarinPal, etc. browser return)
router.get('/callback', asyncHandler(handlePaymentCallback));
router.post('/callback', asyncHandler(handlePaymentCallback));
router.get('/zarinpal/callback', asyncHandler(handlePaymentCallback));
router.post('/zarinpal/callback', asyncHandler(handlePaymentCallback));

// Zibal gateway public callback (browser redirect)
router.get('/zibal/callback', asyncHandler(handleZibalCallback));
router.post('/zibal/callback', asyncHandler(handleZibalCallback));

export const paymentsCallbackRouter = router;
