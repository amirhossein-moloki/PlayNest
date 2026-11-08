import { Prisma, TicketStatus, TicketPriority, TicketCategory, TicketSenderType } from '@prisma/client';
import { prisma } from '../../config/prisma';

export interface ListTicketsFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedToUserId?: string;
  customerAccountId?: string;
  userId?: string;
  gamingCenterId?: string;
  startDate?: Date;
  endDate?: Date;
  OR?: Prisma.TicketWhereInput[];
}

export interface ListTicketsOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const createTicket = async (data: {
  customerAccountId?: string;
  userId?: string;
  gamingCenterId?: string;
  subject: string;
  priority: TicketPriority;
  category: TicketCategory;
  message: string;
}) => {
  const senderId = data.customerAccountId || data.userId;
  if (!senderId) {
    throw new Error('Either customerAccountId or userId must be provided');
  }

  return prisma.ticket.create({
    data: {
      customerAccountId: data.customerAccountId,
      userId: data.userId,
      gamingCenterId: data.gamingCenterId,
      subject: data.subject,
      priority: data.priority,
      category: data.category,
      messages: {
        create: {
          senderId,
          senderType: TicketSenderType.USER,
          text: data.message,
        },
      },
    },
    include: {
      messages: true,
      customerAccount: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          role: true,
        },
      },
      gamingCenter: {
        select: {
          id: true,
          name: true,
        },
      },
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
      user: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          role: true,
        },
      },
      gamingCenter: {
        select: {
          id: true,
          name: true,
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
  if (filters.userId) where.userId = filters.userId;
  if (filters.gamingCenterId) where.gamingCenterId = filters.gamingCenterId;

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
        user: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
        gamingCenter: {
          select: {
            id: true,
            name: true,
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
