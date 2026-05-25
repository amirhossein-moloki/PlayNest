import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/prisma';
import { createTestSalon, createTestUser, createTestService, createTestShift } from '../../common/utils/test-utils';
import { add, set } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { IdempotencyRepo } from '../../common/repositories/idempotency.repo';

describe('POST /api/v1/public/gamingCenters/:salonSlug/reservations', () => {
  let gamingCenter: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let staff: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let station: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeAll(async () => {
    await prisma.reservation.deleteMany({});
    await IdempotencyRepo.clearAll();
    await prisma.userService.deleteMany({});
    await prisma.gameStation.deleteMany({});
    await prisma.staffShift.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.settings.deleteMany({});
    await prisma.gamingCenter.deleteMany({});

    gamingCenter = await createTestSalon({
      slug: 'test-gamingCenter-public-reservation',
      settings: {
        create: {
          allowOnlineBooking: true,
          onlineBookingAutoConfirm: false,
          timeZone: 'America/New_York',
        },
      },
    });
    staff = await createTestUser({ gamingCenterId: gamingCenter.id, role: 'STAFF' });
    await prisma.user.update({ where: { id: staff.id }, data: { isPublic: true } });
    station = await createTestService({ gamingCenterId: gamingCenter.id, durationMinutes: 60, price: 75000 });

    const startTime = set(add(new Date(), { days: 7 }), { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 });
    await createTestShift({
      gamingCenterId: gamingCenter.id,
      userId: staff.id,
      dayOfWeek: startTime.getDay(),
      startTime: '09:00:00',
      endTime: '17:00:00',
    });
    await prisma.userService.create({ data: { userId: staff.id, stationId: station.id } });
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({});
    await IdempotencyRepo.clearAll();
    await prisma.userService.deleteMany({});
    await prisma.gameStation.deleteMany({});
    await prisma.staffShift.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.settings.deleteMany({});
    await prisma.gamingCenter.deleteMany({});
    await prisma.$disconnect();
  });

  it('creates a pending public reservation and replays the same response with the same idempotency key', async () => {
    const startTime = set(add(new Date(), { days: 7 }), { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 });
    const idempotencyKey = uuidv4();
    const payload = {
      stationId: station.id,
      staffId: staff.id,
      startTime: startTime.toISOString(),
      customer: {
        fullName: 'John Doe',
        phone: '+15551234567',
      },
    };

    const firstResponse = await request(app)
      .post(`/api/v1/public/gamingCenters/${gamingCenter.slug}/reservations`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(firstResponse.status).toBe(201);
    expect(firstResponse.body.success).toBe(true);
    expect(firstResponse.body.data.status).toBe('PENDING');
    expect(firstResponse.body.data.stationId).toBe(station.id);
    expect(firstResponse.body.data.staffId).toBe(staff.id);
    expect(firstResponse.body.data.(stationSnapshot as any)).toBe(station.name);
    expect(firstResponse.body.data.(stationSnapshot as any)).toBe(station.durationMinutes);
    expect(firstResponse.body.data.(stationSnapshot as any)).toBe(station.price);
    expect(firstResponse.body.data.(stationSnapshot as any)).toBe(station.currency);

    const secondResponse = await request(app)
      .post(`/api/v1/public/gamingCenters/${gamingCenter.slug}/reservations`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(secondResponse.status).toBe(201);
    expect(secondResponse.body.success).toBe(true);
    expect(secondResponse.body.data.id).toBe(firstResponse.body.data.id);

    const bookingCount = await prisma.reservation.count({
      where: {
        gamingCenterId: gamingCenter.id,
        staffId: staff.id,
        startTime,
      },
    });
    expect(bookingCount).toBe(1);
  });
});
