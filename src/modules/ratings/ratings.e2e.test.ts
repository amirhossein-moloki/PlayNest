import request from 'supertest';
import httpStatus from 'http-status';
import app from '../../app';
import { prisma } from '../../config/prisma';
import { GamingCenter, User, UserRole, ReservationStatus, RatingTarget, RatingStatus } from '@prisma/client';
import { createTestUser, createTestSalon, generateToken } from '../../common/utils/test-utils';

describe('Rating Routes', () => {
  let gamingCenter: GamingCenter;
  let manager: User;
  let managerToken: string;
  let customerAccount: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let profile: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let reservation: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeAll(async () => {
    await prisma.$connect();
    gamingCenter = await createTestSalon();
    manager = await createTestUser({ gamingCenterId: gamingCenter.id, role: UserRole.MANAGER });
    managerToken = generateToken({ actorId: manager.id, actorType: 'USER' });

    customerAccount = await prisma.customerAccount.create({
      data: { phone: '09129998877', fullName: 'John Doe' }
    });

    profile = await prisma.customerProfile.create({
      data: {
        gamingCenterId: gamingCenter.id,
        customerAccountId: customerAccount.id,
        displayName: 'John'
      }
    });

    reservation = await prisma.reservation.create({
      data: {
        gamingCenterId: gamingCenter.id,
        customerProfileId: profile.id,
        customerAccountId: customerAccount.id,
        stationId: (await prisma.gameStation.create({
          data: {
            gamingCenterId: gamingCenter.id,
            name: 'Test GameStation',
            durationMinutes: 30,
            price: 1000,
            currency: 'IRR'
          }
        })).id,
        staffId: manager.id,
        createdByUserId: manager.id,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        (stationSnapshot as any): 'Test GameStation',
        (stationSnapshot as any): 30,
        (stationSnapshot as any): 1000,
        (stationSnapshot as any): 'IRR',
        totalPrice: 1000,
        status: ReservationStatus.COMPLETED,
      }
    });
  });

  afterAll(async () => {
    await prisma.rating.deleteMany({});
    await prisma.reservation.deleteMany({});
    await prisma.customerProfile.deleteMany({});
    await prisma.customerAccount.deleteMany({});
    await prisma.gameStation.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.gamingCenter.deleteMany({});
    await prisma.$disconnect();
  });

  describe('POST /public/gamingCenters/:salonSlug/reservations/:reservationId/ratings', () => {
    it('should submit a rating and return 201', async () => {
      const reviewPayload = {
        reservationId: reservation.id,
        target: RatingTarget.SALON,
        rating: 5,
        comment: 'Great station!',
      };

      const res = await request(app)
        .post(`/api/v1/public/gamingCenters/${gamingCenter.slug}/reservations/${reservation.id}/ratings`)
        .send(reviewPayload);

      expect(res.status).toBe(httpStatus.CREATED);
      expect(res.body.success).toBe(true);
      expect(res.body.data.comment).toBe(reviewPayload.comment);
    });

    it('should return 400 if reservation is not COMPLETED', async () => {
      const pendingBooking = await prisma.reservation.create({
        data: { ...reservation, id: undefined, status: ReservationStatus.PENDING } as any // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const res = await request(app)
        .post(`/api/v1/public/gamingCenters/${gamingCenter.slug}/reservations/${pendingBooking.id}/ratings`)
        .send({ reservationId: pendingBooking.id, target: RatingTarget.SALON, rating: 5 });

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /public/gamingCenters/:salonSlug/ratings', () => {
    it('should list published ratings', async () => {
      const res = await request(app)
        .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/ratings`);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /gamingCenters/:gamingCenterId/ratings/:id/status', () => {
    it('should hide a rating', async () => {
      const rating = await prisma.rating.findFirst({ where: { gamingCenterId: gamingCenter.id } });

      const res = await request(app)
        .patch(`/api/v1/gamingCenters/${gamingCenter.id}/ratings/${rating?.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: RatingStatus.HIDDEN });

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.data.status).toBe(RatingStatus.HIDDEN);

      // Verify it's no longer in public list
      const publicRes = await request(app)
        .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/ratings`);
      const hiddenReview = publicRes.body.data.find((r: any) => r.id === rating?.id); // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(hiddenReview).toBeUndefined();
    });
  });
});
