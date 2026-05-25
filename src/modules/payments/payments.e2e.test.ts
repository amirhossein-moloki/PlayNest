import request from 'supertest';
import cuid from 'cuid';
import app from '../../app';
import { createTestSalon, createTestService, createTestBooking, createTestUser, generateToken } from '../../common/utils/test-utils';
import { ReservationPaymentState, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';

describe('Payments E2E', () => {
  let gamingCenterId: string;
  let reservationId: string;
  let token: string;

  beforeEach(async () => {
    // Reset DB
    await prisma.$executeRaw`TRUNCATE "GamingCenter", "User", "GameStation", "Reservation", "Payment", "CustomerAccount", "CustomerProfile" RESTART IDENTITY CASCADE;`;
    const gamingCenter = await createTestSalon();
    const user = await createTestUser({ gamingCenterId: gamingCenter.id, role: UserRole.MANAGER });
    gamingCenterId = gamingCenter.id;
    const station = await createTestService({ gamingCenterId });
    const reservation = await createTestBooking({ gamingCenterId, stationId: station.id, staffId: user.id });
    reservationId = reservation.id;
    token = generateToken({ userId: user.id, gamingCenterId: gamingCenter.id, role: user.role });
  });

  describe('POST /api/v1/gamingCenters/:gamingCenterId/reservations/:reservationId/payments/init', () => {
    it('should initiate a payment for a valid reservation', async () => {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservations/${reservationId}/payments/init`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', cuid())
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('paymentId');
      expect(res.body.data).toHaveProperty('checkoutUrl');
    });

    it('should return 409 if the reservation is already paid', async () => {
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { paymentState: ReservationPaymentState.PAID },
      });

      await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservations/${reservationId}/payments/init`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', cuid())
        .expect(409);
    });

    it('should return 404 if a user from another gamingCenter tries to initiate a payment', async () => {
      // Create a second gamingCenter and a reservation within it
      const salonB = await createTestSalon({ name: 'GamingCenter B', slug: 'gamingCenter-b' });
      const userB = await createTestUser({ gamingCenterId: salonB.id, phone: '9876543210' });
      const serviceB = await createTestService({ gamingCenterId: salonB.id });
      const bookingB = await createTestBooking({ gamingCenterId: salonB.id, stationId: serviceB.id, staffId: userB.id });

      // The token belongs to a user from the first gamingCenter (gamingCenterId)
      await request(app)
        .post(`/api/v1/gamingCenters/${salonB.id}/reservations/${bookingB.id}/payments/init`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', cuid())
        .expect(404);
    });

    it('should allow a user with the STAFF role to initiate a payment', async () => {
      // Create a user with the STAFF role
      const staffUser = await createTestUser({
        gamingCenterId,
        role: UserRole.STAFF,
        phone: '1112223333', // a different phone number
      });
      const staffToken = generateToken({ userId: staffUser.id, gamingCenterId, role: staffUser.role });

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservations/${reservationId}/payments/init`)
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Idempotency-Key', cuid())
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('paymentId');
      expect(res.body.data).toHaveProperty('checkoutUrl');
    });
  });
});
