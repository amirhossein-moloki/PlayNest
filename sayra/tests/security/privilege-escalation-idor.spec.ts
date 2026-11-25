/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { SessionActorType, UserRole } from '@prisma/client';
import { createUserSchema, updateUserSchema } from '../../src/modules/users/users.validators';
import * as usersStation from '../../src/modules/users/users.station';
import * as userRepo from '../../src/modules/users/users.repo';
import { supportRouter, adminRouter } from '../../src/modules/tickets/tickets.routes';
import * as ticketStation from '../../src/modules/tickets/tickets.station';
import * as ticketRepo from '../../src/modules/tickets/tickets.repo';
import notificationsRouter from '../../src/modules/notifications/notifications.routes';
import { notificationsRepo } from '../../src/modules/notifications/notifications.repo';
import { NotificationStation } from '../../src/modules/notifications/notifications.station';
import { responseMiddleware } from '../../src/common/middleware/response';
import { errorHandler } from '../../src/common/errors/errorHandler';

let mockActor: any = null;

jest.mock('../../src/common/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    if (!mockActor) {
      const err: any = new Error('Unauthorized');
      err.statusCode = 401;
      return next(err);
    }
    req.actor = mockActor;
    next();
  },
  invalidateActorCache: jest.fn(async () => undefined),
}));

describe('SEC-014: Tenant MANAGER->ADMIN Escalation & Tickets / Notification Logs IDOR Remediation', () => {
  const app = express();
  app.use(express.json());
  app.use(responseMiddleware);
  app.use('/api/v1/support/tickets', supportRouter);
  app.use('/api/v1/admin/tickets', adminRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use(errorHandler);

  beforeEach(() => {
    jest.restoreAllMocks();
    mockActor = null;
  });

  describe('Tenant Staff ADMIN Assignment Blocking', () => {
    it('rejects role=ADMIN in createUserSchema and updateUserSchema while permitting SUPERVISOR/STAFF/MANAGER', async () => {
      expect(
        (
          await createUserSchema.safeParseAsync({
            body: { fullName: 'Malicious Staff', phone: '09123456789', role: UserRole.ADMIN },
          })
        ).success
      ).toBe(false);

      expect(
        (
          await updateUserSchema.safeParseAsync({
            params: { userId: 'clx0000000000000000000001' },
            body: { role: UserRole.ADMIN },
          })
        ).success
      ).toBe(false);

      expect(
        (
          await createUserSchema.safeParseAsync({
            body: { fullName: 'Valid Staff', phone: '09123456789', role: UserRole.STAFF },
          })
        ).success
      ).toBe(true);
    });

    it('blocks tenant MANAGER from creating or promoting a staff member to UserRole.ADMIN in usersStation', async () => {
      await expect(
        usersStation.createStaffMember(
          'gc-1',
          { fullName: 'Malicious', phone: '09123456789', role: UserRole.ADMIN as any },
          { id: 'mgr-1', actorType: SessionActorType.USER }
        )
      ).rejects.toMatchObject({ statusCode: 403 });

      jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
        id: 'staff-1',
        gamingCenterId: 'gc-1',
        role: UserRole.STAFF,
      } as any);

      await expect(
        usersStation.updateStaffMember(
          'gc-1',
          'staff-1',
          { role: UserRole.ADMIN as any },
          { id: 'mgr-1', actorType: SessionActorType.USER }
        )
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('Global Support & Admin Tickets Isolation', () => {
    it('returns 403 when a tenant USER with UserRole.ADMIN calls /support/tickets or /admin/tickets', async () => {
      mockActor = {
        id: 'tenant-admin-1',
        actorType: SessionActorType.USER,
        role: UserRole.ADMIN,
        gamingCenterId: 'gc-1',
      };

      const supportRes = await request(app).get('/api/v1/support/tickets');
      expect(supportRes.status).toBe(403);

      const adminRes = await request(app).get('/api/v1/admin/tickets');
      expect(adminRes.status).toBe(403);

      const statsRes = await request(app).get('/api/v1/admin/tickets/statistics');
      expect(statsRes.status).toBe(403);
    });

    it('prevents legacy tenant UserRole.ADMIN from bypassing ticket ownership check in getTicketDetails', async () => {
      jest.spyOn(ticketRepo, 'findTicketById').mockResolvedValue({
        id: 'ticket-other',
        userId: 'other-user-id',
        customerAccountId: null,
        gamingCenterId: 'gc-other',
      } as any);

      await expect(
        ticketStation.getTicketDetails('ticket-other', {
          id: 'tenant-admin-1',
          role: UserRole.ADMIN,
          actorType: SessionActorType.USER,
        })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('allows PLATFORM_ADMIN with mfaVerified=true to access /admin/tickets/statistics', async () => {
      mockActor = {
        id: 'pa-1',
        actorType: SessionActorType.PLATFORM_ADMIN,
        isSuperuser: true,
        mfaVerified: true,
      };
      jest.spyOn(ticketRepo, 'listTickets').mockResolvedValue({
        items: [],
        pagination: { totalItems: 3, page: 1, limit: 1, totalPages: 3 },
      } as any);

      const res = await request(app).get('/api/v1/admin/tickets/statistics');
      expect(res.status).toBe(200);
    });
  });

  describe('Cross-Tenant Notification Logs & Retry IDOR Prevention', () => {
    it('blocks tenant USER (even UserRole.ADMIN) from querying another tenant notification logs and scopes to own tenant', async () => {
      mockActor = {
        id: 'tenant-admin-1',
        actorType: SessionActorType.USER,
        role: UserRole.ADMIN,
        gamingCenterId: 'gc-own',
      };

      const crossRes = await request(app).get('/api/v1/notifications/logs?gamingCenterId=gc-victim');
      expect(crossRes.status).toBe(403);

      const listSpy = jest.spyOn(NotificationStation, 'listNotificationLogs').mockResolvedValue({
        items: [],
        pagination: { totalItems: 0, page: 1, pageSize: 20, totalPages: 0 },
      } as any);

      const ownRes = await request(app).get('/api/v1/notifications/logs');
      expect(ownRes.status).toBe(200);
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({ gamingCenterId: 'gc-own' })
      );
    });

    it('returns 404 when tenant manager/admin tries to retry another tenant notification log and 409 on SENT logs', async () => {
      mockActor = {
        id: 'mgr-1',
        actorType: SessionActorType.USER,
        role: UserRole.MANAGER,
        gamingCenterId: 'gc-own',
      };

      jest.spyOn(notificationsRepo, 'findLogById').mockResolvedValue({
        id: 'clx0000000000000000000099',
        gamingCenterId: 'gc-victim',
        status: 'FAILED',
      } as any);

      const crossRetry = await request(app).post(
        '/api/v1/notifications/logs/clx0000000000000000000099/retry'
      );
      expect(crossRetry.status).toBe(404);

      jest.spyOn(notificationsRepo, 'findLogById').mockResolvedValue({
        id: 'clx0000000000000000000088',
        gamingCenterId: 'gc-own',
        status: 'SENT',
      } as any);

      const sentRetry = await request(app).post(
        '/api/v1/notifications/logs/clx0000000000000000000088/retry'
      );
      expect(sentRetry.status).toBe(409);
    });
  });
});
