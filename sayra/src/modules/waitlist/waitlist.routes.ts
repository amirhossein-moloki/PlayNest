import { Router } from 'express';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { requireActorType } from '../../common/middleware/requireActorType';
import { validate } from '../../common/middleware/validate';
import { privateApiRateLimiter } from '../../common/middleware/rateLimit';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AppRequest } from '../../types/express';
import { SessionActorType, UserRole } from '@prisma/client';
import * as WaitlistController from './waitlist.controller';
import {
  createWaitlistEntrySchema,
  listWaitlistQuerySchema,
  listWaitlistOffersQuerySchema,
  cancelWaitlistEntrySchema,
  offerActionSchema,
} from './waitlist.validators';

// --- Admin / Manager Waitlist Router ---
const adminWaitlistRouter = Router({ mergeParams: true });
adminWaitlistRouter.use(
  tenantGuard,
  authMiddleware,
  requireRole([UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.STAFF])
);

adminWaitlistRouter.get(
  '/',
  validate(listWaitlistQuerySchema),
  asyncHandler<AppRequest>(WaitlistController.getWaitlistEntries)
);

adminWaitlistRouter.get(
  '/offers',
  validate(listWaitlistOffersQuerySchema),
  asyncHandler<AppRequest>(WaitlistController.getWaitlistOffers)
);

adminWaitlistRouter.post(
  '/entries/:entryId/cancel',
  validate(cancelWaitlistEntrySchema),
  asyncHandler<AppRequest>(WaitlistController.cancelWaitlistEntryAdmin)
);

adminWaitlistRouter.post(
  '/process-matching',
  asyncHandler<AppRequest>(WaitlistController.triggerWaitlistMatchingAdmin)
);

// --- Customer Panel Waitlist Router ---
const customerWaitlistRouter = Router();
customerWaitlistRouter.use(
  privateApiRateLimiter,
  authMiddleware,
  requireActorType(SessionActorType.CUSTOMER)
);

customerWaitlistRouter.post(
  '/',
  validate(createWaitlistEntrySchema),
  asyncHandler<AppRequest>(WaitlistController.createCustomerWaitlistEntry)
);

customerWaitlistRouter.get(
  '/',
  validate(listWaitlistQuerySchema),
  asyncHandler<AppRequest>(WaitlistController.getMyWaitlistEntries)
);

customerWaitlistRouter.post(
  '/entries/:entryId/cancel',
  validate(cancelWaitlistEntrySchema),
  asyncHandler<AppRequest>(WaitlistController.cancelMyWaitlistEntry)
);

customerWaitlistRouter.get(
  '/offers',
  validate(listWaitlistOffersQuerySchema),
  asyncHandler<AppRequest>(WaitlistController.getMyOffers)
);

customerWaitlistRouter.post(
  '/offers/:offerId/accept',
  validate(offerActionSchema),
  asyncHandler<AppRequest>(WaitlistController.acceptOffer)
);

customerWaitlistRouter.post(
  '/offers/:offerId/reject',
  validate(offerActionSchema),
  asyncHandler<AppRequest>(WaitlistController.rejectOffer)
);

// --- Public Waitlist Router ---
const publicWaitlistRouter = Router({ mergeParams: true });

publicWaitlistRouter.post(
  '/',
  validate(createWaitlistEntrySchema),
  asyncHandler<AppRequest>(WaitlistController.createPublicWaitlistEntry)
);

export { adminWaitlistRouter, customerWaitlistRouter, publicWaitlistRouter };
