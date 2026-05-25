
import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/prisma';
import { User, GamingCenter, GameStation } from '@prisma/client';
import { createTestSalon, createTestUser, createTestService, generateToken as createToken } from '../../common/utils/test-utils';

describe('Negative Tenant Isolation E2E Tests', () => {
  let salonA: GamingCenter;
  let salonB: GamingCenter;
  let managerA: User;
  let _managerB: User; // eslint-disable-line @typescript-eslint/no-unused-vars
  let serviceB: GameStation;
  let tokenA: string;

  beforeAll(async () => {
    salonA = await createTestSalon({ slug: 'gamingCenter-a' });
    salonB = await createTestSalon({ slug: 'gamingCenter-b' });

    managerA = await createTestUser({ gamingCenterId: salonA.id, role: 'MANAGER' });
    _managerB = await createTestUser({ gamingCenterId: salonB.id, role: 'MANAGER' });

    // Resource belonging to GamingCenter B
    serviceB = await createTestService({ gamingCenterId: salonB.id });

    tokenA = createToken({ actorId: managerA.id, actorType: 'USER' });
  });

  afterAll(async () => {
    await prisma.userService.deleteMany({});
    await prisma.gameStation.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.gamingCenter.deleteMany({});
    await prisma.$disconnect();
  });

  it('should return 404 Not Found when Manager A tries to access a resource in GamingCenter B', async () => {
    const response = await request(app)
      .get(`/api/v1/gamingCenters/${salonB.id}/stations/${serviceB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(404);
  });

  it('should return 404 Not Found when Manager A tries to list staff from GamingCenter B', async () => {
    const response = await request(app)
      .get(`/api/v1/gamingCenters/${salonB.id}/staff`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(404);
  });

  it('should return 404 Not Found when Manager A tries to create a station in GamingCenter B', async () => {
    const response = await request(app)
      .post(`/api/v1/gamingCenters/${salonB.id}/stations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Cross-Tenant GameStation',
        durationMinutes: 60,
        price: 50000,
        currency: 'IRR',
      });

    expect(response.status).toBe(404);
  });
});
