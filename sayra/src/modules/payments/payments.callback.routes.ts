import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { handleZibalCallback } from './payments.callback.controller';

const router = Router();

// Zibal gateway public callback (browser redirect)
router.get('/zibal/callback', asyncHandler(handleZibalCallback));
router.post('/zibal/callback', asyncHandler(handleZibalCallback));

export const paymentsCallbackRouter = router;
