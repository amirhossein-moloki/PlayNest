import { z } from 'zod';
import { TicketStatus, TicketPriority, TicketCategory } from '@prisma/client';
import { baseFilterSchema } from '../../common/validators/query.validators';

export const createTicketSchema = z.object({
  body: z.object({
    subject: z.string().min(5).max(255),
    message: z.string().min(10),
    priority: z.nativeEnum(TicketPriority).default(TicketPriority.MEDIUM),
    category: z.nativeEnum(TicketCategory),
  }),
});

export const addMessageSchema = z.object({
  body: z.object({
    text: z.string().min(1),
    attachment: z.string().optional(),
  }),
  params: z.object({
    ticketId: z.string().cuid(),
  }),
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(TicketStatus),
  }),
  params: z.object({
    ticketId: z.string().cuid(),
  }),
});

export const assignTicketSchema = z.object({
  body: z.object({
    assignedToUserId: z.string().cuid(),
  }),
  params: z.object({
    ticketId: z.string().cuid(),
  }),
});

export const listTicketsQuerySchema = baseFilterSchema.extend({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  assignedToUserId: z.string().optional(),
  customerAccountId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
