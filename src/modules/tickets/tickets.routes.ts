import { Router } from 'express';
import { UserRole } from '@prisma/client';
import * as ticketController from './tickets.controller';
import { validate } from '../../common/middleware/validate';
import {
  createTicketSchema,
  addMessageSchema,
  updateStatusSchema,
  assignTicketSchema,
} from './tickets.validators';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { asyncHandler } from '../../common/middleware/asyncHandler';

// --- User (Customer) Routes ---
// Note: Usually these would be under /customer or similar.
// Based on prompt: GET /api/v1/tickets, etc.
const userRouter = Router();
userRouter.use(authMiddleware);
userRouter.get('/', asyncHandler(ticketController.getMyTickets));
userRouter.get('/:ticketId', asyncHandler(ticketController.getMyTicketById));
userRouter.post('/', validate(createTicketSchema), asyncHandler(ticketController.createTicket));
userRouter.post('/:ticketId/messages', validate(addMessageSchema), asyncHandler(ticketController.replyToTicket));

// --- Support Routes ---
const supportRouter = Router();
supportRouter.use(authMiddleware, requireRole([UserRole.SUPPORT, UserRole.ADMIN]));
supportRouter.get('/', asyncHandler(ticketController.getAllTickets));
supportRouter.get('/:ticketId', asyncHandler(ticketController.getTicketById));
supportRouter.patch('/:ticketId/assign', validate(assignTicketSchema), asyncHandler(ticketController.assignTicket));
supportRouter.patch('/:ticketId/status', validate(updateStatusSchema), asyncHandler(ticketController.updateStatus));
supportRouter.post('/:ticketId/messages', validate(addMessageSchema), asyncHandler(ticketController.replyToTicket));

// --- Admin Routes ---
const adminRouter = Router();
adminRouter.use(authMiddleware, requireRole([UserRole.ADMIN]));
adminRouter.get('/', asyncHandler(ticketController.getAllTickets));
adminRouter.get('/statistics', asyncHandler(ticketController.getStatistics));
adminRouter.patch('/:ticketId/assign', validate(assignTicketSchema), asyncHandler(ticketController.assignTicket));
adminRouter.patch('/:ticketId/status', validate(updateStatusSchema), asyncHandler(ticketController.updateStatus));

export { userRouter, supportRouter, adminRouter };
