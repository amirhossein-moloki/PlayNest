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
        req.actor = { id: 'mock-manager-id', role: UserRole.MANAGER, gamingCenterId: req.params.gamingCenterId };
      } else if (token === 'mock-staff-token') {
        req.actor = { id: 'mock-staff-id', role: UserRole.STAFF, gamingCenterId: req.params.gamingCenterId };
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

describe('Users API Endpoints', () => {
  let gamingCenterId: string;
  let managerToken: string;
  let staffToken: string;
  let managerId: string;
  let staffId: string;

  beforeAll(async () => {
    const gamingCenter = await prisma.gamingCenter.create({
      data: {
        name: 'Test GamingCenter for Users',
        slug: `test-gamingCenter-users-${Date.now()}`,
      },
    });
    gamingCenterId = gamingCenter.id;

    const manager = await prisma.user.create({
      data: {
        gamingCenterId,
        fullName: 'Test Manager',
        phone: '+10000000001',
        role: UserRole.MANAGER,
        isActive: true,
      },
    });
    managerId = manager.id;

    const staff = await prisma.user.create({
      data: {
        gamingCenterId,
        fullName: 'Test Staff',
        phone: '+10000000002',
        role: UserRole.STAFF,
        isActive: true,
      },
    });
    staffId = staff.id;

    managerToken = 'mock-manager-token';
    staffToken = 'mock-staff-token';
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { gamingCenterId } });
    await prisma.gamingCenter.delete({ where: { id: gamingCenterId } });
    await prisma.$disconnect();
  });

  describe('GET /gamingCenters/:gamingCenterId/staff/:userId', () => {
    it('should return 401 if the request is unauthenticated', async () => {
      const response = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/staff/${staffId}`);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header is missing or invalid',
        },
      });
    });

    it('should allow any authenticated user of the gamingCenter to get a specific staff member', async () => {
      const response = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/staff/${staffId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(staffId);
      expect(response.body.data.fullName).toBe('Test Staff');
    });

    it('should return 404 if the user is not found', async () => {
      const nonExistentId = 'clxxxxxxxxxxxxxx';
      const response = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/staff/${nonExistentId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /gamingCenters/:gamingCenterId/staff/:userId', () => {
    it('should allow a MANAGER to soft-delete a user', async () => {
      const userToDelete = await prisma.user.create({
        data: {
          gamingCenterId,
          fullName: 'To Be Deleted',
          phone: '+10000000003',
          role: UserRole.STAFF,
        },
      });

      const response = await request(app)
        .delete(`/api/v1/gamingCenters/${gamingCenterId}/staff/${userToDelete.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(204);

      const deletedUser = await prisma.user.findUnique({ where: { id: userToDelete.id } });
      expect(deletedUser?.isActive).toBe(false);
    });

    it('should NOT allow a non-MANAGER to delete a user', async () => {
      const response = await request(app)
        .delete(`/api/v1/gamingCenters/${gamingCenterId}/staff/${managerId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Forbidden: You do not have the required permissions.',
        },
      });
    });

    it('should return 404 if the user to delete is not found', async () => {
      const nonExistentId = 'clxxxxxxxxxxxxxx';
      const response = await request(app)
        .delete(`/api/v1/gamingCenters/${gamingCenterId}/staff/${nonExistentId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(404);
    });
  });
});
