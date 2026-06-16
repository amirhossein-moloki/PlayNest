import { http, HttpResponse, delay } from 'msw';
import { db } from '../db';

export const ticketHandlers = [
  // --- User (Customer) Tickets ---

  // GET /api/v1/tickets
  http.get('*/api/v1/tickets', async () => {
    await delay(Math.random() * 700 + 500);
    // In a real mock we might filter by actor, but here we'll just return some or all
    const items = db.tickets;
    return HttpResponse.json({
      success: true,
      data: items,
      meta: {
        requestId: 'req-' + Math.random().toString(36).substr(2, 9),
        pagination: { totalItems: items.length, page: 1, pageSize: 10, totalPages: 1 }
      }
    });
  }),

  // GET /api/v1/tickets/:ticketId
  http.get('*/api/v1/tickets/:ticketId', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { ticketId } = params;
    const ticket = db.tickets.find((t: any) => t.id === ticketId); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!ticket) {
      return HttpResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Ticket not found' }
      }, { status: 404 });
    }
    const messages = db.ticketMessages.filter((m: any) => m.ticketId === ticketId); // eslint-disable-line @typescript-eslint/no-explicit-any
    return HttpResponse.json({
      success: true,
      data: { ...ticket, messages },
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // POST /api/v1/tickets
  http.post('*/api/v1/tickets', async ({ request }) => {
    await delay(Math.random() * 700 + 500);
    const body = await request.json() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const newTicket = {
      id: 'tick-' + Math.random().toString(36).substr(2, 9),
      subject: body.subject,
      priority: body.priority || 'MEDIUM',
      category: body.category,
      status: 'OPEN',
      customerAccountId: 'cust-1', // Default mock customer
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.tickets.push(newTicket);

    const newMessage = {
      id: 'msg-' + Math.random().toString(36).substr(2, 9),
      ticketId: newTicket.id,
      text: body.message,
      senderId: 'cust-1',
      senderType: 'USER',
      createdAt: new Date().toISOString(),
    };
    db.ticketMessages.push(newMessage);

    return HttpResponse.json({
      success: true,
      data: { ...newTicket, messages: [newMessage] },
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    }, { status: 201 });
  }),

  // POST /api/v1/tickets/:ticketId/messages (Reply)
  http.post('*/api/v1/tickets/:ticketId/messages', async ({ params, request }) => {
    await delay(Math.random() * 700 + 500);
    const { ticketId } = params;
    const body = await request.json() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const ticket = db.tickets.find((t: any) => t.id === ticketId); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!ticket) {
      return HttpResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Ticket not found' }
      }, { status: 404 });
    }

    const newMessage = {
      id: 'msg-' + Math.random().toString(36).substr(2, 9),
      ticketId: ticketId as string,
      text: body.text,
      attachment: body.attachment,
      senderId: 'cust-1', // or staff id if it's support
      senderType: 'USER', // logic can be more complex based on URL but controller handles both
      createdAt: new Date().toISOString(),
    };
    db.ticketMessages.push(newMessage);

    return HttpResponse.json({
      success: true,
      data: newMessage,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    }, { status: 201 });
  }),

  // --- Support Tickets ---

  // GET /api/v1/support/tickets
  http.get('*/api/v1/support/tickets', async () => {
    await delay(Math.random() * 700 + 500);
    const items = db.tickets;
    return HttpResponse.json({
      success: true,
      data: items,
      meta: {
        requestId: 'req-' + Math.random().toString(36).substr(2, 9),
        pagination: { totalItems: items.length, page: 1, pageSize: 10, totalPages: 1 }
      }
    });
  }),

  // GET /api/v1/support/tickets/:ticketId
  http.get('*/api/v1/support/tickets/:ticketId', async ({ params }) => {
    await delay(Math.random() * 700 + 500);
    const { ticketId } = params;
    const ticket = db.tickets.find((t: any) => t.id === ticketId); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!ticket) {
      return HttpResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Ticket not found' }
      }, { status: 404 });
    }
    const messages = db.ticketMessages.filter((m: any) => m.ticketId === ticketId); // eslint-disable-line @typescript-eslint/no-explicit-any
    return HttpResponse.json({
      success: true,
      data: { ...ticket, messages },
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // PATCH /api/v1/support/tickets/:ticketId/assign
  http.patch('*/api/v1/support/tickets/:ticketId/assign', async ({ params, request }) => {
    await delay(Math.random() * 700 + 500);
    const { ticketId } = params;
    const body = await request.json() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const ticket = db.tickets.find((t: any) => t.id === ticketId); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!ticket) {
      return HttpResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Ticket not found' }
      }, { status: 404 });
    }
    ticket.assignedToUserId = body.assignedToUserId;
    ticket.updatedAt = new Date().toISOString();

    return HttpResponse.json({
      success: true,
      data: ticket,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // PATCH /api/v1/support/tickets/:ticketId/status
  http.patch('*/api/v1/support/tickets/:ticketId/status', async ({ params, request }) => {
    await delay(Math.random() * 700 + 500);
    const { ticketId } = params;
    const body = await request.json() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const ticket = db.tickets.find((t: any) => t.id === ticketId); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!ticket) {
      return HttpResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Ticket not found' }
      }, { status: 404 });
    }
    ticket.status = body.status;
    ticket.updatedAt = new Date().toISOString();
    if (body.status === 'CLOSED') {
      ticket.closedAt = new Date().toISOString();
    }

    return HttpResponse.json({
      success: true,
      data: ticket,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // POST /api/v1/support/tickets/:ticketId/messages (Reply from Support)
  http.post('*/api/v1/support/tickets/:ticketId/messages', async ({ params, request }) => {
    await delay(Math.random() * 700 + 500);
    const { ticketId } = params;
    const body = await request.json() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const ticket = db.tickets.find((t: any) => t.id === ticketId); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!ticket) {
      return HttpResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Ticket not found' }
      }, { status: 404 });
    }

    const newMessage = {
      id: 'msg-' + Math.random().toString(36).substr(2, 9),
      ticketId: ticketId as string,
      text: body.text,
      attachment: body.attachment,
      senderId: 'staff-1', // Default mock staff
      senderType: 'SUPPORT',
      createdAt: new Date().toISOString(),
    };
    db.ticketMessages.push(newMessage);

    // Update ticket status to ANSWERED
    ticket.status = 'ANSWERED';
    ticket.updatedAt = new Date().toISOString();

    return HttpResponse.json({
      success: true,
      data: newMessage,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    }, { status: 201 });
  }),

  // --- Admin Tickets ---

  // GET /api/v1/admin/tickets
  http.get('*/api/v1/admin/tickets', async () => {
    await delay(Math.random() * 700 + 500);
    const items = db.tickets;
    return HttpResponse.json({
      success: true,
      data: items,
      meta: {
        requestId: 'req-' + Math.random().toString(36).substr(2, 9),
        pagination: { totalItems: items.length, page: 1, pageSize: 10, totalPages: 1 }
      }
    });
  }),

  // GET /api/v1/admin/tickets/statistics
  http.get('*/api/v1/admin/tickets/statistics', async () => {
    await delay(Math.random() * 700 + 500);
    const total = db.tickets.length;
    const open = db.tickets.filter((t: any) => t.status === 'OPEN').length; // eslint-disable-line @typescript-eslint/no-explicit-any
    const closed = db.tickets.filter((t: any) => t.status === 'CLOSED').length; // eslint-disable-line @typescript-eslint/no-explicit-any
    return HttpResponse.json({
      success: true,
      data: { total, open, closed },
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // PATCH /api/v1/admin/tickets/:ticketId/assign
  http.patch('*/api/v1/admin/tickets/:ticketId/assign', async ({ params, request }) => {
    await delay(Math.random() * 700 + 500);
    const { ticketId } = params;
    const body = await request.json() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const ticket = db.tickets.find((t: any) => t.id === ticketId); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!ticket) {
      return HttpResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Ticket not found' }
      }, { status: 404 });
    }
    ticket.assignedToUserId = body.assignedToUserId;
    ticket.updatedAt = new Date().toISOString();

    return HttpResponse.json({
      success: true,
      data: ticket,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),

  // PATCH /api/v1/admin/tickets/:ticketId/status
  http.patch('*/api/v1/admin/tickets/:ticketId/status', async ({ params, request }) => {
    await delay(Math.random() * 700 + 500);
    const { ticketId } = params;
    const body = await request.json() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const ticket = db.tickets.find((t: any) => t.id === ticketId); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!ticket) {
      return HttpResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Ticket not found' }
      }, { status: 404 });
    }
    ticket.status = body.status;
    ticket.updatedAt = new Date().toISOString();
    if (body.status === 'CLOSED') {
      ticket.closedAt = new Date().toISOString();
    }

    return HttpResponse.json({
      success: true,
      data: ticket,
      meta: { requestId: 'req-' + Math.random().toString(36).substr(2, 9) }
    });
  }),
];
