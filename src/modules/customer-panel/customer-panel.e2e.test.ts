import request from 'supertest';
import httpStatus from 'http-status';
import app from '../../app';
import { prisma } from '../../config/prisma';
import { ReservationStatus, GamingCenter, GameStation, User, SessionActorType, CustomerAccount } from '@prisma/client';
import {
  createTestSalon,
  createTestService,
  createTestUser,
  generateToken,
} from '../../common/utils/test-utils';

describe('Customer Panel E2E Tests', () => {
  let gamingCenter: GamingCenter;
  let station: GameStation;
  let staff: User;
  let customerAccount: CustomerAccount;
  let customerToken: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Cleanup
    await prisma.rating.deleteMany();
    await prisma.gamingSession.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.customerProfile.deleteMany();
    await prisma.customerAccount.deleteMany();
    await prisma.staffStationSkill.deleteMany();
    await prisma.gameStation.deleteMany();
    await prisma.user.deleteMany();
    await prisma.gamingCenter.deleteMany();

    // Setup
    gamingCenter = await createTestSalon();
    station = await createTestService({ gamingCenterId: gamingCenter.id });
    staff = await createTestUser({ gamingCenterId: gamingCenter.id });

    // Link staff to station
    await prisma.staffStationSkill.create({
      data: {
        userId: staff.id,
        stationId: station.id,
      }
    });

    customerAccount = await prisma.customerAccount.create({
      data: {
        phone: '09121112233',
        fullName: 'John Doe',
      },
    });

    customerToken = generateToken({
      actorId: customerAccount.id,
      actorType: SessionActorType.CUSTOMER,
    });
  });

  describe('GET /api/v1/customer/me', () => {
    it('should return the customer profile', async () => {
      const res = await request(app)
        .get('/api/v1/customer/me')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phone).toBe('09121112233');
      expect(res.body.data.fullName).toBe('John Doe');
    });

    it('should return 403 if actor is not a customer', async () => {
      const staffToken = generateToken({
        actorId: staff.id,
        actorType: SessionActorType.USER,
      });

      const res = await request(app)
        .get('/api/v1/customer/me')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /api/v1/customer/reservations', () => {
    it('should return an empty list when there are no reservations', async () => {
      const res = await request(app)
        .get('/api/v1/customer/reservations')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.totalItems).toBe(0);
    });

    it('should return customer reservations', async () => {
      // Create a profile and a reservation for this customer
      const profile = await prisma.customerProfile.create({
        data: {
          gamingCenterId: gamingCenter.id,
          customerAccountId: customerAccount.id,
          displayName: 'John',
        },
      });

      await prisma.reservation.create({
        data: {
          gamingCenterId: gamingCenter.id,
          customerAccountId: customerAccount.id,
          customerProfileId: profile.id,
          stationId: station.id,
          staffId: staff.id,
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
          stationSnapshot: {
            name: station.name,
            hourlyPrice: station.hourlyPrice,
            stationType: station.stationType,
          },
          totalPrice: station.hourlyPrice,
          totalHours: 1,
          createdByUserId: staff.id,
          status: ReservationStatus.CONFIRMED,
        },
      });

      const res = await request(app)
        .get('/api/v1/customer/reservations')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].gamingCenter.name).toBe(gamingCenter.name);
    });
  });

  describe('POST /api/v1/customer/reservations/:reservationId/cancel', () => {
    it('should cancel a pending/confirmed reservation', async () => {
      const profile = await prisma.customerProfile.create({
        data: {
          gamingCenterId: gamingCenter.id,
          customerAccountId: customerAccount.id,
        },
      });

      const reservation = await prisma.reservation.create({
        data: {
          gamingCenterId: gamingCenter.id,
          customerAccountId: customerAccount.id,
          customerProfileId: profile.id,
          stationId: station.id,
          staffId: staff.id,
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
          stationSnapshot: {
            name: station.name,
            hourlyPrice: station.hourlyPrice,
            stationType: station.stationType,
          },
          totalPrice: station.hourlyPrice,
          totalHours: 1,
          createdByUserId: staff.id,
          status: ReservationStatus.CONFIRMED,
        },
      });

      const res = await request(app)
        .post(`/api/v1/customer/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Changed my mind' });

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.data.status).toBe(ReservationStatus.CANCELED);
      expect(res.body.data.cancelReason).toBe('Changed my mind');
    });

    it('should not cancel other people\'s reservations', async () => {
      const otherCustomer = await prisma.customerAccount.create({
        data: { phone: '09129999999' }
      });
      const profile = await prisma.customerProfile.create({
        data: {
          gamingCenterId: gamingCenter.id,
          customerAccountId: otherCustomer.id,
        },
      });

      const reservation = await prisma.reservation.create({
        data: {
          gamingCenterId: gamingCenter.id,
          customerAccountId: otherCustomer.id,
          customerProfileId: profile.id,
          stationId: station.id,
          staffId: staff.id,
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
          stationSnapshot: {
            name: station.name,
            hourlyPrice: station.hourlyPrice,
            stationType: station.stationType,
          },
          totalPrice: station.hourlyPrice,
          totalHours: 1,
          createdByUserId: staff.id,
          status: ReservationStatus.CONFIRMED,
        },
      });

      const res = await request(app)
        .post(`/api/v1/customer/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Malicious attempt' });

      expect(res.status).toBe(httpStatus.NOT_FOUND);
    });
  });

  describe('POST /api/v1/customer/reservations/:reservationId/ratings', () => {
    it('should submit a rating for a completed reservation', async () => {
      const profile = await prisma.customerProfile.create({
        data: {
          gamingCenterId: gamingCenter.id,
          customerAccountId: customerAccount.id,
        },
      });

      const reservation = await prisma.reservation.create({
        data: {
          gamingCenterId: gamingCenter.id,
          customerAccountId: customerAccount.id,
          customerProfileId: profile.id,
          stationId: station.id,
          staffId: staff.id,
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
          stationSnapshot: {
            name: station.name,
            hourlyPrice: station.hourlyPrice,
            stationType: station.stationType,
          },
          totalPrice: station.hourlyPrice,
          totalHours: 1,
          createdByUserId: staff.id,
          status: ReservationStatus.COMPLETED,
        },
      });

      const res = await request(app)
        .post(`/api/v1/customer/reservations/${reservation.id}/ratings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rating: 5,
          comment: 'Great station!',
        });

      expect(res.status).toBe(httpStatus.CREATED);
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.comment).toBe('Great station!');
    });

    it('should not allow reviewing a non-completed reservation', async () => {
      const profile = await prisma.customerProfile.create({
        data: {
          gamingCenterId: gamingCenter.id,
          customerAccountId: customerAccount.id,
        },
      });

      const reservation = await prisma.reservation.create({
        data: {
          gamingCenterId: gamingCenter.id,
          customerAccountId: customerAccount.id,
          customerProfileId: profile.id,
          stationId: station.id,
          staffId: staff.id,
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
          stationSnapshot: {
            name: station.name,
            hourlyPrice: station.hourlyPrice,
            stationType: station.stationType,
          },
          totalPrice: station.hourlyPrice,
          totalHours: 1,
          createdByUserId: staff.id,
          status: ReservationStatus.CONFIRMED,
        },
      });

      const res = await request(app)
        .post(`/api/v1/customer/reservations/${reservation.id}/ratings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rating: 5,
          comment: 'Great station!',
        });

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
      expect(res.body.message).toContain('Only completed reservations can be reviewed');
    });
  });
});
