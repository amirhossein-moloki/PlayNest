import { Prisma, TicketStatus, TicketPriority, TicketCategory, TicketSenderType } from '@prisma/client';
import { prisma } from '../../config/prisma';

export interface ListTicketsFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedToUserId?: string;
  customerAccountId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ListTicketsOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const createTicket = async (data: {
  customerAccountId: string;
  subject: string;
  priority: TicketPriority;
  category: TicketCategory;
  message: string;
}) => {
  return prisma.ticket.create({
    data: {
      customerAccountId: data.customerAccountId,
      subject: data.subject,
      priority: data.priority,
      category: data.category,
      messages: {
        create: {
          senderId: data.customerAccountId,
          senderType: TicketSenderType.USER,
          text: data.message,
        },
      },
    },
    include: {
      messages: true,
    },
  });
};

export const createMessage = async (data: {
  ticketId: string;
  senderId: string;
  senderType: TicketSenderType;
  text: string;
  attachment?: string;
}) => {
  return prisma.ticketMessage.create({
    data,
  });
};

export const findTicketById = async (id: string) => {
  return prisma.ticket.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      customerAccount: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
  });
};

export const listTickets = async (filters: ListTicketsFilters, options: ListTicketsOptions) => {
  const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;
  const skip = (page - 1) * limit;

  const where: Prisma.TicketWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.category) where.category = filters.category;
  if (filters.assignedToUserId) where.assignedToUserId = filters.assignedToUserId;
  if (filters.customerAccountId) where.customerAccountId = filters.customerAccountId;

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const [items, totalItems] = await Promise.all([
    prisma.ticket.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        customerAccount: {
          select: {
            id: true,
            fullName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    items,
    pagination: {
      page,
      pageSize: limit,
      totalItems,
      totalPages,
    },
  };
};

export const updateTicket = async (id: string, data: Prisma.TicketUpdateInput) => {
  return prisma.ticket.update({
    where: { id },
    data,
  });
};
