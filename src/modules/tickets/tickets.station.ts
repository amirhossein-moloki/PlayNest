import { TicketStatus, TicketSenderType, TicketPriority, TicketCategory, UserRole } from '@prisma/client';
import * as ticketRepo from './tickets.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { auditService } from '../audit/audit.station';

export const createTicket = async (data: {
  customerAccountId: string;
  subject: string;
  priority: TicketPriority;
  category: TicketCategory;
  message: string;
}, context: { ip?: string; userAgent?: string }) => {
  const ticket = await ticketRepo.createTicket(data);

  await auditService.recordLog({
    customerId: data.customerAccountId,
    action: 'TICKET_CREATE',
    entity: 'Ticket',
    entityId: ticket.id,
    newData: ticket,
    ipAddress: context.ip,
    userAgent: context.userAgent,
  });

  return ticket;
};

export const addMessage = async (
  ticketId: string,
  senderId: string,
  senderType: TicketSenderType,
  text: string,
  attachment?: string,
  context?: { ip?: string; userAgent?: string }
) => {
  const ticket = await ticketRepo.findTicketById(ticketId);
  if (!ticket) {
    throw new AppError('Ticket not found', httpStatus.NOT_FOUND);
  }

  if (ticket.status === TicketStatus.CLOSED) {
    throw new AppError('Cannot add message to a closed ticket', httpStatus.BAD_REQUEST);
  }

  // Permission check: if sender is USER (customer), they must own the ticket
  if (senderType === TicketSenderType.USER && ticket.customerAccountId !== senderId) {
    throw new AppError('Unauthorized to reply to this ticket', httpStatus.FORBIDDEN);
  }

  const message = await ticketRepo.createMessage({
    ticketId,
    senderId,
    senderType,
    text,
    attachment,
  });

  // Workflow logic
  let newStatus: TicketStatus = ticket.status;
  if (senderType === TicketSenderType.SUPPORT) {
    newStatus = TicketStatus.ANSWERED;
  } else if (senderType === TicketSenderType.USER && ticket.status === TicketStatus.ANSWERED) {
    newStatus = TicketStatus.PENDING;
  }

  if (newStatus !== ticket.status) {
    await ticketRepo.updateTicket(ticketId, { status: newStatus });
  }

  await auditService.recordLog({
    userId: senderType === TicketSenderType.SUPPORT ? senderId : undefined,
    customerId: senderType === TicketSenderType.USER ? senderId : undefined,
    action: 'TICKET_MESSAGE_ADD',
    entity: 'Ticket',
    entityId: ticketId,
    newData: message,
    ipAddress: context?.ip,
    userAgent: context?.userAgent,
  });

  return message;
};

export const assignTicket = async (
  ticketId: string,
  userId: string,
  actor: { id: string; role?: UserRole },
  context?: { ip?: string; userAgent?: string }
) => {
  const ticket = await ticketRepo.findTicketById(ticketId);
  if (!ticket) {
    throw new AppError('Ticket not found', httpStatus.NOT_FOUND);
  }

  // Logic: only ADMIN or already assigned SUPPORT can reassign?
  // Requirement: "Support agents can access assigned tickets".
  // Let's allow ADMIN and potentially any SUPPORT to assign if they have permission.

  const updatedTicket = await ticketRepo.updateTicket(ticketId, {
    assignedToUserId: userId,
  });

  await auditService.recordLog({
    userId: actor.id,
    action: 'TICKET_ASSIGN',
    entity: 'Ticket',
    entityId: ticketId,
    oldData: { assignedToUserId: ticket.assignedToUserId },
    newData: { assignedToUserId: userId },
    ipAddress: context?.ip,
    userAgent: context?.userAgent,
  });

  return updatedTicket;
};

export const updateTicketStatus = async (
  ticketId: string,
  status: TicketStatus,
  actor: { id: string; role?: UserRole },
  context?: { ip?: string; userAgent?: string }
) => {
  const ticket = await ticketRepo.findTicketById(ticketId);
  if (!ticket) {
    throw new AppError('Ticket not found', httpStatus.NOT_FOUND);
  }

  const updateData: any = { status };
  if (status === TicketStatus.CLOSED) {
    updateData.closedAt = new Date();
  } else {
    updateData.closedAt = null;
  }

  const updatedTicket = await ticketRepo.updateTicket(ticketId, updateData);

  await auditService.recordLog({
    userId: actor.id,
    action: 'TICKET_STATUS_UPDATE',
    entity: 'Ticket',
    entityId: ticketId,
    oldData: { status: ticket.status },
    newData: { status },
    ipAddress: context?.ip,
    userAgent: context?.userAgent,
  });

  return updatedTicket;
};

export const getTicketDetails = async (ticketId: string, actor: { id: string; role?: UserRole; actorType: string }) => {
  const ticket = await ticketRepo.findTicketById(ticketId);
  if (!ticket) {
    throw new AppError('Ticket not found', httpStatus.NOT_FOUND);
  }

  // Authorization check
  if (actor.actorType === 'CUSTOMER') {
    if (ticket.customerAccountId !== actor.id) {
      throw new AppError('Access denied', httpStatus.FORBIDDEN);
    }
  } else if (actor.role === UserRole.SUPPORT) {
    if (ticket.assignedToUserId !== actor.id) {
       // Support might still need to view it if they are looking at all tickets to pick one?
       // Requirement says: "SUPPORT: Can access assigned tickets."
       // I will enforce this strictly for now.
       throw new AppError('Access denied: ticket not assigned to you', httpStatus.FORBIDDEN);
    }
  }

  return ticket;
};

export const getTicketsList = async (filters: ticketRepo.ListTicketsFilters, options: ticketRepo.ListTicketsOptions) => {
  return ticketRepo.listTickets(filters, options);
};
