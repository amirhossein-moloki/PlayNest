
import { Router } from 'express';
import { getAuditLogs } from './audit.controller';
import { listAuditLogsSchema } from './audit.validators';
import { validate } from '../../common/middleware/validate';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AppRequest } from '../../types/express';

const router = Router({ mergeParams: true });

router.get(
  '/',
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER]),
  validate(listAuditLogsSchema),
  asyncHandler<AppRequest>(getAuditLogs)
);

export default router;
