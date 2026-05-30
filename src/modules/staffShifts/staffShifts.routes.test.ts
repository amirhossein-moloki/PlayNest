import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/prisma';
import { UserRole } from '@prisma/client';
import createHttpError from 'http-errors';
import { Request, Response, NextFunction } from 'express';

jest.mock('../../common/middleware/auth', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      if (token === 'mock-manager-token') {
        req.actor = { id: 'mock-manager-id', role: UserRole.MANAGER, gamingCenterId: req.params.gamingCenterId, actorType: 'USER' };
      } else if (token === 'mock-staff-token') {
        req.actor = { id: 'mock-staff-id', role: UserRole.STAFF, gamingCenterId: req.params.gamingCenterId, actorType: 'USER' };
      }
      return next();
    }
    return next(createHttpError(401, 'Authorization header is missing or invalid'));
  },
}));

jest.mock('../../common/middleware/requireRole', () => ({
  requireRole: (roles: UserRole[]) => (req: Request, _res: Response, next: NextFunction) => {
    if (req.actor && roles.includes(req.actor.role!)) {
      next();
    } else {
      next(createHttpError(403, 'Forbidden: You do not have the required permissions.'));
    }
  },
}));

describe('Shifts API Endpoints', () => {
  let gamingCenterId: string;
  let managerToken: string;
  let staffToken: string;
  let _managerId: string; // eslint-disable-line @typescript-eslint/no-unused-vars
  let staffId: string;

  beforeAll(async () => {
    const gamingCenter = await prisma.gamingCenter.create({
      data: {
        name: 'Test GamingCenter for Shifts',
        slug: `test-gamingCenter-staffShifts-${Date.now()}`,
      },
    });
    gamingCenterId = gamingCenter.id;

    const manager = await prisma.user.create({
      data: {
        gamingCenterId,
        fullName: 'StaffShift Manager',
        phone: '+10000000004',
        role: UserRole.MANAGER,
      },
    });
    _managerId = manager.id;

    const staff = await prisma.user.create({
      data: {
        gamingCenterId,
        fullName: 'StaffShift Staff',
        phone: '+10000000005',
        role: UserRole.STAFF,
      },
    });
    staffId = staff.id;

    managerToken = 'mock-manager-token';
    staffToken = 'mock-staff-token';
  });

  afterAll(async () => {
    await prisma.staffShift.deleteMany({ where: { gamingCenterId } });
    await prisma.user.deleteMany({ where: { gamingCenterId } });
    await prisma.gamingCenter.delete({ where: { id: gamingCenterId } });
    await prisma.$disconnect();
  });

  describe('PUT /gamingCenters/:gamingCenterId/staff/:userId/staffShifts', () => {
    const validShiftsPayload = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
      { dayOfWeek: 3, startTime: '00:00', endTime: '00:00', isActive: false },
    ];

    it('should allow a MANAGER to upsert staffShifts for a staff member', async () => {
      const response = await request(app)
        .put(`/api/v1/gamingCenters/${gamingCenterId}/staff/${staffId}/staffShifts`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validShiftsPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(validShiftsPayload.length);

      const staffShifts = await prisma.staffShift.findMany({ where: { userId: staffId }, orderBy: { dayOfWeek: 'asc' } });
      expect(staffShifts.length).toBe(validShiftsPayload.length);
      expect(staffShifts[0].startTime).toBe('09:00');
      expect(staffShifts[2].isActive).toBe(false);
    });

    it('should NOT allow a non-MANAGER to upsert staffShifts', async () => {
      const response = await request(app)
        .put(`/api/v1/gamingCenters/${gamingCenterId}/staff/${staffId}/staffShifts`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send(validShiftsPayload);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Forbidden: You do not have the required permissions.',
        },
      });
    });

    it('should return a 400 validation error for invalid data', async () => {
      const invalidPayload = [{ dayOfWeek: 8, startTime: '99:99', endTime: '17:00', isActive: true }];
      const response = await request(app)
        .put(`/api/v1/gamingCenters/${gamingCenterId}/staff/${staffId}/staffShifts`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(invalidPayload);

      expect(response.status).toBe(400);
    });

    it('should return 404 if the user is not found', async () => {
      const nonExistentId = 'clxxxxxxxxxxxxxx';
      const response = await request(app)
        .put(`/api/v1/gamingCenters/${gamingCenterId}/staff/${nonExistentId}/staffShifts`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validShiftsPayload);

      expect(response.status).toBe(404);
    });
  });
});
