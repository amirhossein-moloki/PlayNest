import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as ticketStation from '../../../../src/modules/tickets/tickets.station';
import * as ticketRepo from '../../../../src/modules/tickets/tickets.repo';
import { auditService } from '../../../../src/modules/audit/audit.station';
import { TicketStatus, TicketPriority, TicketCategory, UserRole, SessionActorType, TicketSenderType } from '@prisma/client';

jest.mock('../../../../src/modules/tickets/tickets.repo');
jest.mock('../../../../src/modules/audit/audit.station');

const MockedTicketRepo = ticketRepo as jest.Mocked<typeof ticketRepo>;
const MockedAuditStation = auditService as jest.Mocked<typeof auditService>;

describe('Ticket System Station Unit Tests (Mocked Repo)', () => {
  const customerAccountId = 'cust-123';
  const supportUserId = 'supp-123';
  const actor = { id: 'admin-1', role: UserRole.ADMIN, actorType: SessionActorType.USER };
  const context = { ip: '127.0.0.1', userAgent: 'test-agent' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully create a ticket and record audit log', async () => {
    const input = {
      customerAccountId,
      subject: 'Test Subject',
      message: 'Test message content',
      priority: TicketPriority.HIGH,
      category: TicketCategory.TECHNICAL,
    };

    const createdTicket = { id: 'ticket-123', ...input, status: TicketStatus.OPEN, createdAt: new Date(), updatedAt: new Date(), closedAt: null, assignedToUserId: null };
    MockedTicketRepo.createTicket.mockResolvedValue(createdTicket as any);

    const result = await ticketStation.createTicket(input, context);

    expect(result).toEqual(createdTicket);
    expect(MockedTicketRepo.createTicket).toHaveBeenCalledWith(input);
    expect(MockedAuditStation.recordLog).toHaveBeenCalledWith(expect.objectContaining({
      customerId: customerAccountId,
      action: 'TICKET_CREATE',
      entity: 'Ticket',
      entityId: createdTicket.id,
    }));
  });

  it('should successfully add a message and update status to ANSWERED when support replies', async () => {
    const ticketId = 'ticket-123';
    const ticket = { id: ticketId, customerAccountId, status: TicketStatus.OPEN, assignedToUserId: supportUserId };
    const message = { id: 'msg-1', ticketId, text: 'Reply', senderId: supportUserId, senderType: TicketSenderType.SUPPORT };

    MockedTicketRepo.findTicketById.mockResolvedValue(ticket as any);
    MockedTicketRepo.createMessage.mockResolvedValue(message as any);

    await ticketStation.addMessage(ticketId, supportUserId, TicketSenderType.SUPPORT, 'Reply', undefined, { id: supportUserId, role: UserRole.SUPPORT, actorType: 'USER' }, context);

    expect(MockedTicketRepo.createMessage).toHaveBeenCalled();
    expect(MockedTicketRepo.updateTicket).toHaveBeenCalledWith(ticketId, { status: TicketStatus.ANSWERED });
  });

  it('should successfully assign a ticket', async () => {
    const ticketId = 'ticket-123';
    const ticket = { id: ticketId, assignedToUserId: null };
    MockedTicketRepo.findTicketById.mockResolvedValue(ticket as any);
    MockedTicketRepo.updateTicket.mockResolvedValue({ ...ticket, assignedToUserId: supportUserId } as any);

    await ticketStation.assignTicket(ticketId, supportUserId, actor, context);

    expect(MockedTicketRepo.updateTicket).toHaveBeenCalledWith(ticketId, {
      assignedTo: { connect: { id: supportUserId } },
    });
  });
});
