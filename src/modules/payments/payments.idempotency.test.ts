import request from 'supertest';
import cuid from 'cuid';
import app from '../../app';
import { prisma } from '../../config/prisma';
import { UserRole, SessionActorType } from '@prisma/client';
import { createTestSalon, createTestUser, createTestService, createTestReservation, generateToken } from '../../common/utils/test-utils';
import { IdempotencyRepo } from '../../common/repositories/idempotency.repo';


// Mock fetch for ZarinPal
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    json: () => Promise.resolve({
      data: { authority: 'mock-authority', code: 100 },
      errors: []
    }),
  })
) as jest.Mock;

describe('Payments Idempotency E2E', () => {
  let gamingCenterId: string;
  let reservationId: string;
  let token: string;
  let userId: string;

  beforeEach(async () => {
    // Clean up the database before each test
    await prisma.gamingSession.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.reservation.deleteMany({});
    await prisma.staffStationSkill.deleteMany({});
    await prisma.gameStation.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.customerProfile.deleteMany({});
    await prisma.customerAccount.deleteMany({});
    await prisma.gamingCenter.deleteMany({});
    await IdempotencyRepo.clearAll();

    const gamingCenter = await createTestSalon();
    gamingCenterId = gamingCenter.id;

    const user = await createTestUser({ gamingCenterId, role: UserRole.MANAGER });
    userId = user.id;
    token = generateToken({ actorId: user.id, actorType: SessionActorType.USER });

    const station = await createTestService({ gamingCenterId });

    const customerAccount = await prisma.customerAccount.create({ data: { phone: '09120000001' } });
    const customerProfile = await prisma.customerProfile.create({ data: { gamingCenterId, customerAccountId: customerAccount.id } });

    const reservation = await createTestReservation(gamingCenterId, customerAccount.id, customerProfile.id, station.id, userId);
    reservationId = reservation.id;
  });

  describe('POST /api/v1/gamingCenters/:gamingCenterId/reservations/:reservationId/payments/init', () => {
    it('should return the same response when replaying a successful request with the same idempotency key', async () => {
      const idempotencyKey = cuid();
      const endpoint = `/api/v1/gamingCenters/${gamingCenterId}/reservations/${reservationId}/payments/init`;

      // First request
      const res1 = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send()
        .expect(201);

      expect(res1.body.success).toBe(true);
      const paymentId1 = res1.body.data.paymentId;
      expect(paymentId1).toBeDefined();

      // Second request (replay)
      const res2 = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send()
        .expect(201);

      expect(res2.body.success).toBe(true);
      const paymentId2 = res2.body.data.paymentId;
      expect(paymentId2).toBe(paymentId1);

      // Verify that only one payment was created in the database
      const paymentCount = await prisma.payment.count({
        where: { idempotencyKey },
      });
      expect(paymentCount).toBe(1);
    });

    it('should return 409 Conflict when reusing an idempotency key with a different payload', async () => {
      const idempotencyKey = cuid();
      const endpoint = `/api/v1/gamingCenters/${gamingCenterId}/reservations/${reservationId}/payments/init`;

      // First request with a specific payload
      await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ amount: 1000 }) // Add a body to be hashed
        .expect(201);

      // Second request with the same key but a different payload
      const res = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ amount: 2000 }) // Different body
        .expect(409);

      expect(res.body.errors[0].code).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
    });

    it('should handle concurrent requests with the same idempotency key, succeeding once and failing others', async () => {
      const idempotencyKey = cuid();
      const endpoint = `/api/v1/gamingCenters/${gamingCenterId}/reservations/${reservationId}/payments/init`;

      const req = () =>
        request(app)
          .post(endpoint)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', idempotencyKey)
          .send();

      // Send two requests concurrently
      const [res1, res2] = await Promise.all([req(), req()]);

      const successResponse = res1.status === 201 ? res1 : res2;
      const conflictResponse = res1.status === 409 ? res1 : res2;

      expect(successResponse.status).toBe(201);
      expect(conflictResponse.status).toBe(409);
      expect(conflictResponse.body.errors[0].code).toBe('IDEMPOTENCY_REQUEST_IN_PROGRESS');

      // Verify that only one payment was actually created
      const paymentCount = await prisma.payment.count({
        where: { idempotencyKey },
      });
      expect(paymentCount).toBe(1);
    });
  });
});
