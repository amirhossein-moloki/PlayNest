import { Router } from 'express';
import * as CustomerController from './customers.controller';
import { validate } from '../../common/middleware/validate';
import {
  createCustomerSchema,
  updateCustomerSchema,
  getCustomersSchema,
  customerIdParamSchema,
} from './customers.validators';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { UserRole } from '@prisma/client';
import { privateApiRateLimiter } from '../../common/middleware/rateLimit';

const router = Router({ mergeParams: true });

router.use(privateApiRateLimiter, authMiddleware, tenantGuard);

router.get(
  '/',
  requireRole([UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF]),
  validate(getCustomersSchema),
  CustomerController.getCustomers
);

router.get(
  '/:customerId',
  requireRole([UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF]),
  validate(customerIdParamSchema),
  CustomerController.getCustomerById
);

router.post(
  '/',
  requireRole([UserRole.MANAGER, UserRole.SUPERVISOR]),
  validate(createCustomerSchema),
  CustomerController.createCustomer
);

router.patch(
  '/:customerId',
  requireRole([UserRole.MANAGER, UserRole.SUPERVISOR]),
  validate(updateCustomerSchema),
  CustomerController.updateCustomer
);

// Optional: DELETE
router.delete(
  '/:customerId',
  requireRole([UserRole.MANAGER]),
  validate(customerIdParamSchema),
  CustomerController.deleteCustomer
);

export { router as customersRouter };
