import request from 'supertest';
import httpStatus from 'http-status';
import app from '../../app';
import { prisma } from '../../config/prisma';
import { GamingCenter, User, UserRole } from '@prisma/client';
import { createTestUser, createTestSalon, generateToken } from '../../common/utils/test-utils';

describe('Settings Routes', () => {
  let gamingCenter: GamingCenter;
  let manager: User;
  let managerToken: string;

  beforeAll(async () => {
    await prisma.$connect();
    gamingCenter = await createTestSalon();
    manager = await createTestUser({ gamingCenterId: gamingCenter.id, role: UserRole.MANAGER });
    managerToken = generateToken({ actorId: manager.id, actorType: 'USER' });
  });

  afterAll(async () => {
    await prisma.settings.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.gamingCenter.deleteMany({});
    await prisma.$disconnect();
  });

  describe('GET /gamingCenters/:gamingCenterId/settings', () => {
    it('should return settings for a gamingCenter', async () => {
      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenter.id}/settings`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.gamingCenterId).toBe(gamingCenter.id);
    });
  });

  describe('PATCH /gamingCenters/:gamingCenterId/settings', () => {
    it('should update settings for a gamingCenter', async () => {
      const updatePayload = {
        timeZone: 'Asia/Tehran',
        workStartTime: '09:00',
        workEndTime: '18:00',
        allowOnlineBooking: true,
      };

      const res = await request(app)
        .patch(`/api/v1/gamingCenters/${gamingCenter.id}/settings`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(updatePayload);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.timeZone).toBe(updatePayload.timeZone);
      expect(res.body.data.workStartTime).toBe(updatePayload.workStartTime);
      expect(res.body.data.allowOnlineBooking).toBe(true);
    });

    it('should return 400 for invalid workStartTime format', async () => {
      const res = await request(app)
        .patch(`/api/v1/gamingCenters/${gamingCenter.id}/settings`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ workStartTime: '9:00' }); // Invalid format, should be HH:mm

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });
  });
});
