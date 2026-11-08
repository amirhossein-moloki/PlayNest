import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as ticketStation from '../../../../src/modules/tickets/tickets.station';
import * as ticketRepo from '../../../../src/modules/tickets/tickets.repo';
import { auditService } from '../../../../src/modules/audit/audit.station';
import { MelipayamakStation } from '../../../../src/modules/notifications/melipayamak.station';
import { TicketStatus, TicketPriority, TicketCategory, UserRole, SessionActorType, TicketSenderType } from '@prisma/client';

jest.mock('../../../../src/modules/tickets/tickets.repo');
jest.mock('../../../../src/modules/audit/audit.station');
jest.mock('../../../../src/modules/notifications/melipayamak.station');

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
    MockedTicketRepo.createTicket.mockResolvedValue(createdTicket /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

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
    const ticket = {
      id: ticketId,
      customerAccountId,
      status: TicketStatus.OPEN,
      assignedToUserId: supportUserId,
      customerAccount: { phone: '09121111111' },
    };
    const message = { id: 'msg-1', ticketId, text: 'Reply', senderId: supportUserId, senderType: TicketSenderType.SUPPORT };

    MockedTicketRepo.findTicketById.mockResolvedValue(ticket /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
    MockedTicketRepo.createMessage.mockResolvedValue(message /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
    (MelipayamakStation.sendTicketReplySms as jest.MockedFunction<typeof MelipayamakStation.sendTicketReplySms>).mockResolvedValue({
      success: true,
      recId: 'sms-reply-123',
    });

    await ticketStation.addMessage(ticketId, supportUserId, TicketSenderType.SUPPORT, 'Reply', undefined, { id: supportUserId, role: UserRole.ADMIN, actorType: 'USER' }, context);

    expect(MockedTicketRepo.createMessage).toHaveBeenCalled();
    expect(MockedTicketRepo.updateTicket).toHaveBeenCalledWith(ticketId, { status: TicketStatus.ANSWERED });
    expect(MelipayamakStation.sendTicketReplySms).toHaveBeenCalledWith('09121111111', ticketId);
  });

  it('should successfully assign a ticket', async () => {
    const ticketId = 'ticket-123';
    const ticket = { id: ticketId, assignedToUserId: null };
    MockedTicketRepo.findTicketById.mockResolvedValue(ticket /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
    MockedTicketRepo.updateTicket.mockResolvedValue({ ...ticket, assignedToUserId: supportUserId } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    await ticketStation.assignTicket(ticketId, supportUserId, actor, context);

    expect(MockedTicketRepo.updateTicket).toHaveBeenCalledWith(ticketId, {
      assignedTo: { connect: { id: supportUserId } },
    });
  });

  it('should allow gaming center manager to create a ticket and record audit log', async () => {
    const managerUserId = 'mgr-456';
    const gamingCenterId = 'gc-789';
    const input = {
      userId: managerUserId,
      gamingCenterId,
      subject: 'Manager Technical Support Request',
      message: 'Need help connecting hardware to playnest platform',
      priority: TicketPriority.HIGH,
      category: TicketCategory.TECHNICAL,
    };

    const createdTicket = {
      id: 'ticket-manager-456',
      customerAccountId: null,
      ...input,
      status: TicketStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
      assignedToUserId: null,
    };
    MockedTicketRepo.createTicket.mockResolvedValue(createdTicket /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const result = await ticketStation.createTicket(input, context);

    expect(result).toEqual(createdTicket);
    expect(MockedTicketRepo.createTicket).toHaveBeenCalledWith(input);
    expect(MockedAuditStation.recordLog).toHaveBeenCalledWith(expect.objectContaining({
      gamingCenterId,
      userId: managerUserId,
      actorType: SessionActorType.USER,
      action: 'TICKET_CREATE',
      entity: 'Ticket',
      entityId: createdTicket.id,
    }));
  });

  it('should allow gaming center manager to view ticket details and reply', async () => {
    const managerUserId = 'mgr-456';
    const ticketId = 'ticket-manager-456';
    const ticket = {
      id: ticketId,
      customerAccountId: null,
      userId: managerUserId,
      gamingCenterId: 'gc-789',
      status: TicketStatus.ANSWERED,
    };

    MockedTicketRepo.findTicketById.mockResolvedValue(ticket /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
    const message = { id: 'msg-reply-1', ticketId, text: 'Follow-up reply', senderId: managerUserId, senderType: TicketSenderType.USER };
    MockedTicketRepo.createMessage.mockResolvedValue(message /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    // 1. Manager views ticket details
    const fetched = await ticketStation.getTicketDetails(ticketId, { id: managerUserId, role: UserRole.MANAGER, actorType: 'USER' });
    expect(fetched).toEqual(ticket);

    // 2. Manager replies to ticket
    const reply = await ticketStation.addMessage(
      ticketId,
      managerUserId,
      TicketSenderType.USER,
      'Follow-up reply',
      undefined,
      { id: managerUserId, role: UserRole.MANAGER, actorType: 'USER' },
      context
    );

    expect(reply).toEqual(message);
    expect(MockedTicketRepo.updateTicket).toHaveBeenCalledWith(ticketId, { status: TicketStatus.PENDING });
    expect(MockedAuditStation.recordLog).toHaveBeenCalledWith(expect.objectContaining({
      userId: managerUserId,
      actorType: SessionActorType.USER,
      action: 'TICKET_MESSAGE_ADD',
    }));
  });

  it('should forbid other gaming center managers from viewing non-owned ticket', async () => {
    const ticketId = 'ticket-manager-456';
    const ticket = {
      id: ticketId,
      customerAccountId: null,
      userId: 'mgr-456',
      gamingCenterId: 'gc-789',
      status: TicketStatus.OPEN,
    };

    MockedTicketRepo.findTicketById.mockResolvedValue(ticket /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    await expect(
      ticketStation.getTicketDetails(ticketId, { id: 'other-mgr-999', role: UserRole.MANAGER, actorType: 'USER' })
    ).rejects.toThrow('Access denied');
  });
});
