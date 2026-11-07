import request from 'supertest';
import app from '../../../src/app';
import { GroupBookingStation } from '../../../src/modules/group-booking/group-booking.station';
import { prisma } from '../../../src/config/prisma';
import AppError from '../../../src/common/errors/AppError';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../src/modules/group-booking/group-booking.station');

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Public Group Reservations API', () => {
  const mockCenter = {
    id: 'center_15',
    name: 'GameNet Arena',
    slug: 'gamenet-arena',
    isActive: true,
  };

  const validPayload = {
    startTime: '2026-11-10T14:00:00.000Z',
    durationMinutes: 120,
    items: [
      { stationId: 'clh1111111111111111111111' },
      { stationId: 'clh2222222222222222222222' },
    ],
    customer: {
      fullName: 'Amir Hossein',
      phone: '09121234567',
    },
    note: 'Group reservation test',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue(mockCenter);
    (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue(mockCenter);
  });

  it('should return 201 and created group booking on successful reservation', async () => {
    const mockCreatedBooking = {
      id: 'gb_001',
      gamingCenterId: 'center_15',
      startTime: new Date('2026-11-10T14:00:00.000Z'),
      endTime: new Date('2026-11-10T16:00:00.000Z'),
      totalPrice: 240000,
      status: 'CONFIRMED',
      items: [
        { id: 'gbi_01', stationId: 'clh1111111111111111111111' },
        { id: 'gbi_02', stationId: 'clh2222222222222222222222' },
      ],
    };

    (GroupBookingStation.createPublicGroupBooking as jest.Mock).mockResolvedValue(mockCreatedBooking);

    const res = await request(app)
      .post('/api/v1/public/gamingCenters/gamenet-arena/group-reservations')
      .set('idempotency-key', 'idemp_key_1234567890123456')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('gb_001');
    expect(GroupBookingStation.createPublicGroupBooking).toHaveBeenCalledWith(
      'gamenet-arena',
      expect.objectContaining({
        durationMinutes: 120,
        customer: { fullName: 'Amir Hossein', phone: '09121234567' },
      })
    );
  });

  it('should return 409 Conflict when one or more stations are unavailable', async () => {
    (GroupBookingStation.createPublicGroupBooking as jest.Mock).mockRejectedValue(
      new AppError('One or more selected stations are not available for the requested time.', 409, {
        code: 'SLOT_NOT_AVAILABLE',
        details: {
          unavailableStations: [
            { stationId: 'clh2222222222222222222222', stationName: 'PC-002' },
          ],
        },
      })
    );

    const res = await request(app)
      .post('/api/v1/public/gamingCenters/gamenet-arena/group-reservations')
      .set('idempotency-key', 'idemp_key_conflict_12345678')
      .send(validPayload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SLOT_NOT_AVAILABLE');
  });

  it('should return 400 when body validation fails', async () => {
    const invalidPayload = {
      startTime: 'not-a-date',
      items: [],
      customer: {
        fullName: 'A',
        phone: '123',
      },
    };

    const res = await request(app)
      .post('/api/v1/public/gamingCenters/gamenet-arena/group-reservations')
      .send(invalidPayload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
