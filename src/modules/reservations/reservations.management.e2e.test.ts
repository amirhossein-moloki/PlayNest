import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/prisma';
import { createTestSalon, createTestUser, createTestService, createTestShift, generateToken } from '../../common/utils/test-utils';
import { add, set } from 'date-fns';
import { UserRole } from '@prisma/client';

describe('Reservation Management E2E', () => {
  let gamingCenter: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let manager: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let staff: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let station: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let managerToken: string;

  beforeAll(async () => {
    await prisma.reservation.deleteMany({});
    await prisma.userService.deleteMany({});
    await prisma.gameStation.deleteMany({});
    await prisma.staffShift.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.settings.deleteMany({});
    await prisma.gamingCenter.deleteMany({});

    gamingCenter = await createTestSalon({
      settings: {
        create: {
          allowOnlineBooking: true,
          onlineBookingAutoConfirm: false,
          timeZone: 'America/New_York',
        },
      },
    });
    manager = await createTestUser({ gamingCenterId: gamingCenter.id, role: UserRole.MANAGER });
    staff = await createTestUser({ gamingCenterId: gamingCenter.id, role: UserRole.STAFF });
    station = await createTestService({ gamingCenterId: gamingCenter.id, durationMinutes: 45, price: 120000 });
    await prisma.userService.create({ data: { userId: staff.id, stationId: station.id } });

    const startTime = set(add(new Date(), { days: 7 }), { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 });
    await createTestShift({
      gamingCenterId: gamingCenter.id,
      userId: staff.id,
      dayOfWeek: startTime.getDay(),
      startTime: '09:00:00',
      endTime: '17:00:00',
    });

    managerToken = generateToken({
      actorId: manager.id,
      actorType: 'USER',
      gamingCenterId: gamingCenter.id,
      role: manager.role,
    });
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({});
    await prisma.userService.deleteMany({});
    await prisma.gameStation.deleteMany({});
    await prisma.staffShift.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.settings.deleteMany({});
    await prisma.gamingCenter.deleteMany({});
    await prisma.$disconnect();
  });

  it('creates, reschedules, and completes a reservation through the management endpoints', async () => {
    const startTime = set(add(new Date(), { days: 7 }), { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 });

    const createResponse = await request(app)
      .post(`/api/v1/gamingCenters/${gamingCenter.id}/reservations`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        stationId: station.id,
        staffId: staff.id,
        startTime: startTime.toISOString(),
        customer: {
          fullName: 'Jane Customer',
          phone: '+15550001111',
          email: 'jane@example.com',
        },
        note: 'Initial reservation',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.id).toBeDefined();

    const reservationId = createResponse.body.data.id;

    const updatedStartAt = add(startTime, { hours: 1 });
    const updateResponse = await request(app)
      .patch(`/api/v1/gamingCenters/${gamingCenter.id}/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        startTime: updatedStartAt.toISOString(),
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(new Date(updateResponse.body.data.startTime).toISOString()).toBe(updatedStartAt.toISOString());

    const expectedEndAt = add(updatedStartAt, { minutes: station.durationMinutes });
    expect(new Date(updateResponse.body.data.endTime).toISOString()).toBe(expectedEndAt.toISOString());

    const completeResponse = await request(app)
      .post(`/api/v1/gamingCenters/${gamingCenter.id}/reservations/${reservationId}/complete`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.success).toBe(true);
    expect(completeResponse.body.data.status).toBe('COMPLETED');
  });
});
