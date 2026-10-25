/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { env } from '../../../src/config/env';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SessionActorType, UserRole } from '@prisma/client';
import { auditService, sanitizeAuditData } from '../../../src/modules/audit/audit.station';

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    ['$transaction']: jest.fn(),
  },
}));

describe('Phase 7 Security & Audit Integration Tests', () => {
  const SECRET = env.JWT_ACCESS_SECRET || 'test_secret';

  const makeToken = (actorId: string, actorType: SessionActorType = SessionActorType.USER) => {
    return jwt.sign({ sessionId: 'session-123', actorId, actorType }, SECRET);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication & Authorization Enforcements', () => {
    it('should return 401 Unauthorized when Bearer token is missing', async () => {
      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/users')
        .set('x-api-key', env.STATIC_API_KEY);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || res.body.message).toMatch(/Authorization header is missing/i);
    });

    it('should return 403 Forbidden when user does not possess required role', async () => {
      const token = makeToken('user-staff');

      (prisma.session.findUnique as any).mockResolvedValue({
        id: 'session-123',
        actorId: 'user-staff',
        actorType: SessionActorType.USER,
      });

      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'user-staff',
        role: UserRole.STAFF,
        gamingCenterId: 'gc-1',
      });

      // Staff attempting to post a new user (Manager-only endpoint)
      const res = await request(app)
        .post('/api/v1/gamingCenters/gc-1/users')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: 'New Staff',
          phone: '09123456789',
          role: UserRole.STAFF,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || res.body.message).toMatch(/Forbidden/i);
    });

    it('should enforce tenant boundary (404 Not Found) when user accesses another gamingCenter', async () => {
      const token = makeToken('user-manager');

      (prisma.session.findUnique as any).mockResolvedValue({
        id: 'session-123',
        actorId: 'user-manager',
        actorType: SessionActorType.USER,
      });

      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'user-manager',
        role: UserRole.MANAGER,
        gamingCenterId: 'gc-tenant-a', // Belongs to Tenant A
      });

      // Manager attempting to query audit logs of Tenant B
      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-tenant-b/audit-logs')
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || res.body.message).toMatch(/GamingCenter not found/i);
    });
  });

  describe('Audit Trail & Sensitive Data Sanitization', () => {
    it('should sanitize sensitive security fields from audit log payloads', () => {
      const sensitiveInput = {
        fullName: 'John Doe',
        password: 'SuperSecretPassword123!',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$secret...',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        nested: {
          codeHash: '123456',
          cardNumber: '4532000000008888',
        },
      };

      const sanitized = sanitizeAuditData(sensitiveInput);

      expect(sanitized.fullName).toBe('John Doe');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.passwordHash).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.nested.codeHash).toBe('[REDACTED]');
      expect(sanitized.nested.cardNumber).toBe('[REDACTED]');
    });

    it('should write audit record atomically within a database transaction when provided', async () => {
      const createFn = jest.fn<any>().mockResolvedValue({ id: 'audit-1' });
      const mockTx = {
        auditLog: {
          create: createFn,
        },
      } as any;

      await auditService.recordLog({
        gamingCenterId: 'gc-1',
        userId: 'u-1',
        action: 'SETTINGS_UPDATE',
        entity: 'Settings',
        entityId: 'set-1',
        oldData: { allowOnlineBooking: false },
        newData: { allowOnlineBooking: true },
        tx: mockTx,
      });

      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: {
          gamingCenterId: 'gc-1',
          userId: 'u-1',
          customerId: undefined,
          action: 'SETTINGS_UPDATE',
          entity: 'Settings',
          entityId: 'set-1',
          oldData: { allowOnlineBooking: false },
          newData: { allowOnlineBooking: true },
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });
  });
});
