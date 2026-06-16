import { Response, NextFunction } from 'express';
import * as ticketStation from './tickets.station';
import { AppRequest } from '../../types/express';
import { listTicketsQuerySchema } from './tickets.validators';
import { TicketSenderType, UserRole } from '@prisma/client';

// --- User APIs ---

export const getMyTickets = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const validatedQuery = listTicketsQuerySchema.parse(req.query);
    const result = await ticketStation.getTicketsList(
      { ...validatedQuery, customerAccountId: req.actor.id },
      {
        page: validatedQuery.page || 1,
        limit: validatedQuery.limit || 10,
        sortBy: validatedQuery.sortBy,
        sortOrder: validatedQuery.sortOrder as 'asc' | 'desc',
      }
    );
    res.ok(result.items, { pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

export const getMyTicketById = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketStation.getTicketDetails(req.params.ticketId, req.actor);
    res.ok(ticket);
  } catch (error) {
    next(error);
  }
};

export const createTicket = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketStation.createTicket(
      {
        customerAccountId: req.actor.id,
        ...req.body,
      },
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.created(ticket);
  } catch (error) {
    next(error);
  }
};

export const replyToTicket = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const message = await ticketStation.addMessage(
      req.params.ticketId,
      req.actor.id,
      req.actor.actorType === 'USER' ? TicketSenderType.SUPPORT : TicketSenderType.USER,
      req.body.text,
      req.body.attachment,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.created(message);
  } catch (error) {
    next(error);
  }
};

// --- Support & Admin APIs ---

export const getAllTickets = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const validatedQuery = listTicketsQuerySchema.parse(req.query);

    // Support can only see assigned tickets by default if not admin
    const filters = { ...validatedQuery };
    if (req.actor.role === UserRole.SUPPORT) {
      filters.assignedToUserId = req.actor.id;
    }

    const result = await ticketStation.getTicketsList(
      filters,
      {
        page: validatedQuery.page || 1,
        limit: validatedQuery.limit || 10,
        sortBy: validatedQuery.sortBy,
        sortOrder: validatedQuery.sortOrder as 'asc' | 'desc',
      }
    );
    res.ok(result.items, { pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

export const getTicketById = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketStation.getTicketDetails(req.params.ticketId, req.actor);
    res.ok(ticket);
  } catch (error) {
    next(error);
  }
};

export const assignTicket = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketStation.assignTicket(
      req.params.ticketId,
      req.body.assignedToUserId,
      req.actor,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.ok(ticket);
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketStation.updateTicketStatus(
      req.params.ticketId,
      req.body.status,
      req.actor,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.ok(ticket);
  } catch (error) {
    next(error);
  }
};

export const getStatistics = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    // Basic statistics for admin
    const [total, open, closed] = await Promise.all([
       ticketStation.getTicketsList({}, { page: 1, limit: 1 }),
       ticketStation.getTicketsList({ status: 'OPEN' }, { page: 1, limit: 1 }),
       ticketStation.getTicketsList({ status: 'CLOSED' }, { page: 1, limit: 1 }),
    ]);

    res.ok({
      total: total.pagination.totalItems,
      open: open.pagination.totalItems,
      closed: closed.pagination.totalItems,
    });
  } catch (error) {
    next(error);
  }
};
