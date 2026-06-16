import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../../../src/app';
import { prisma } from '../../../../src/config/prisma';
import { TicketStatus, TicketPriority, TicketCategory, UserRole, SessionActorType } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../../../../src/config/env';

describe('Ticket System Integration Tests', () => {
  let customerToken: string;
  let supportToken: string;
  let adminToken: string;
  let customerAccountId: string;
  let supportUserId: string;
  let adminUserId: string;
  let gamingCenterId: string;

  beforeAll(async () => {
    // Setup Gaming Center
    const gc = await prisma.gamingCenter.create({
      data: {
        name: 'Test Center',
        slug: 'test-center-' + Date.now(),
      },
    });
    gamingCenterId = gc.id;

    // Setup Customer
    const customer = await prisma.customerAccount.create({
      data: {
        phone: '09120000001',
        fullName: 'Test Customer',
      },
    });
    customerAccountId = customer.id;
    customerToken = jwt.sign(
      { actorId: customer.id, actorType: SessionActorType.CUSTOMER },
      env.JWT_ACCESS_SECRET as string,
      { expiresIn: '15m' }
    );

    // Setup Support
    const support = await prisma.user.create({
      data: {
        gamingCenterId,
        phone: '09120000002',
        fullName: 'Test Support',
        role: UserRole.SUPPORT,
      },
    });
    supportUserId = support.id;
    supportToken = jwt.sign(
      { actorId: support.id, actorType: SessionActorType.USER, role: UserRole.SUPPORT },
      env.JWT_ACCESS_SECRET as string,
      { expiresIn: '15m' }
    );

    // Setup Admin
    const admin = await prisma.user.create({
      data: {
        gamingCenterId,
        phone: '09120000003',
        fullName: 'Test Admin',
        role: UserRole.ADMIN,
      },
    });
    adminUserId = admin.id;
    adminToken = jwt.sign(
      { actorId: admin.id, actorType: SessionActorType.USER, role: UserRole.ADMIN },
      env.JWT_ACCESS_SECRET as string,
      { expiresIn: '15m' }
    );
  });

  afterAll(async () => {
    await prisma.ticketMessage.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.user.deleteMany({ where: { id: { in: [supportUserId, adminUserId] } } });
    await prisma.customerAccount.deleteMany({ where: { id: customerAccountId } });
    await prisma.gamingCenter.deleteMany({ where: { id: gamingCenterId } });
  });

  describe('User Ticket APIs', () => {
    let ticketId: string;

    it('should create a new ticket', async () => {
      const response = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          subject: 'Test Subject',
          message: 'This is a test message for ticket creation.',
          priority: TicketPriority.HIGH,
          category: TicketCategory.TECHNICAL,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subject).toBe('Test Subject');
      ticketId = response.body.data.id;
    });

    it('should get own tickets', async () => {
      const response = await request(app)
        .get('/api/v1/tickets')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(ticketId);
    });

    it('should get own ticket by id', async () => {
      const response = await request(app)
        .get(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(ticketId);
      expect(response.body.data.messages).toHaveLength(1);
    });

    it('should reply to own ticket', async () => {
      const response = await request(app)
        .post(`/api/v1/tickets/${ticketId}/messages`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ text: 'Customer follow-up message' });

      expect(response.status).toBe(201);
      expect(response.body.data.text).toBe('Customer follow-up message');
    });
  });

  describe('Support Ticket APIs', () => {
    let ticketId: string;

    beforeAll(async () => {
       const res = await prisma.ticket.create({
         data: {
           customerAccountId,
           subject: 'Support Test Ticket',
           priority: TicketPriority.MEDIUM,
           category: TicketCategory.ACCOUNT,
           status: TicketStatus.OPEN,
           assignedToUserId: supportUserId
         }
       });
       ticketId = res.id;
    });

    it('should list assigned tickets for support', async () => {
      const response = await request(app)
        .get('/api/v1/support/tickets')
        .set('Authorization', `Bearer ${supportToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(ticketId);
    });

    it('should reply to assigned ticket as support', async () => {
      const response = await request(app)
        .post(`/api/v1/support/tickets/${ticketId}/messages`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ text: 'Support response message' });

      expect(response.status).toBe(201);

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket?.status).toBe(TicketStatus.ANSWERED);
    });

    it('should not allow support to access unassigned ticket', async () => {
        const otherTicket = await prisma.ticket.create({
          data: {
            customerAccountId,
            subject: 'Other Ticket',
            category: TicketCategory.SALES
          }
        });

        const response = await request(app)
          .get(`/api/v1/support/tickets/${otherTicket.id}`)
          .set('Authorization', `Bearer ${supportToken}`);

        expect(response.status).toBe(403);
    });
  });

  describe('Admin Ticket APIs', () => {
    let ticketId: string;

    beforeAll(async () => {
      const res = await prisma.ticket.create({
        data: {
          customerAccountId,
          subject: 'Admin Test Ticket',
          category: TicketCategory.FINANCIAL
        }
      });
      ticketId = res.id;
    });

    it('should list all tickets for admin', async () => {
      const response = await request(app)
        .get('/api/v1/admin/tickets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should assign ticket to support', async () => {
      const response = await request(app)
        .patch(`/api/v1/admin/tickets/${ticketId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedToUserId: supportUserId });

      expect(response.status).toBe(200);
      expect(response.body.data.assignedToUserId).toBe(supportUserId);
    });

    it('should change ticket status', async () => {
      const response = await request(app)
        .patch(`/api/v1/admin/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: TicketStatus.CLOSED });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(TicketStatus.CLOSED);
      expect(response.body.data.closedAt).not.toBeNull();
    });

    it('should get statistics', async () => {
        const response = await request(app)
          .get('/api/v1/admin/tickets/statistics')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('open');
        expect(response.body.data).toHaveProperty('closed');
    });
  });
});
