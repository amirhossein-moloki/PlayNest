/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { reservationStation } from '../../../../src/modules/reservation/reservation.station';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { discountsStation } from '../../../../src/modules/discounts/discounts.station';
import { ReservationStatus } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';

describe('Reservation Concurrency Stress Integration Tests', () => {
  const gamingCenterSlug = 'test-center';
  const inputTemplate = {
    stationId: 'clx1234567890station01',
    staffId: 'clx1234567890staff001',
    startTime: '2027-01-01T12:00:00.000Z',
    customer: {
      fullName: 'Concurrent Customer',
      phone: '09121112233',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(discountsStation, 'calculateApplicableDiscount').mockResolvedValue({ applicableDiscount: null, discountAmount: 0 });
  });

  it('simulates 20 parallel requests for identical time slot with exactly 1 success and 19 failures', async () => {
    let booked = false;

    // Mock Station transaction execution
    jest.spyOn(ReservationRepo, 'transaction').mockImplementation(async (fn: any) => {
      // Execute the callback passed to transaction
      return fn({});
    });

    jest.spyOn(ReservationRepo, 'findGamingCenterBySlugWithSettings').mockImplementation(async () => {
      return { id: 'gc-test', slug: gamingCenterSlug, settings: { allowOnlineBooking: true, timeZone: 'UTC' } } as any;
    });

    jest.spyOn(ReservationRepo, 'findStation').mockImplementation(async () => {
      return { id: inputTemplate.stationId, name: 'PS5 Pro', defaultDurationHours: 1, hourlyPrice: 100, stationType: 'CONSOLE' } as any;
    });

    jest.spyOn(ReservationRepo, 'findStaff').mockImplementation(async () => {
      return { id: inputTemplate.staffId } as any;
    });

    jest.spyOn(ReservationRepo, 'findStaffShift').mockImplementation(async () => {
      return { id: 'shift-1', startTime: '08:00', endTime: '22:00' } as any;
    });

    jest.spyOn(ReservationRepo, 'findCustomerAccountByPhone').mockImplementation(async () => {
      return { id: 'ca-1', phone: '09121112233' } as any;
    });

    jest.spyOn(ReservationRepo, 'findCustomerProfile').mockImplementation(async () => {
      return { id: 'cp-1' } as any;
    });

    jest.spyOn(ReservationRepo, 'assertActiveReservationLimitNotExceeded').mockImplementation(async () => {});

    // Simulate database locking or overlap check rejecting after first commit
    jest.spyOn(ReservationRepo, 'findOverlappingReservation').mockImplementation(async () => {
      if (booked) {
        return { id: 'res-existing-1' } as any;
      }
      return null;
    });

    jest.spyOn(ReservationRepo, 'createReservation').mockImplementation(async (data: any) => {
      if (booked) {
        // Postgres exclusion constraint violation error (23P01)
        const err: any = new Error('exclusion constraint error');
        err.code = '23P01';
        throw err;
      }
      booked = true;
      return { id: 'res-created-1', ...data, status: ReservationStatus.PENDING } as any;
    });

    const requests = Array.from({ length: 20 }, (_, i) =>
      reservationStation.createPublicReservation(gamingCenterSlug, {
        ...inputTemplate,
        customer: { fullName: `Customer ${i}`, phone: `091211122${i.toString().padStart(2, '0')}` },
      })
    );

    const results = await Promise.allSettled(requests);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(19);

    rejected.forEach((result) => {
      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(AppError);
        expect((result.reason as AppError).statusCode).toBe(409);
        expect((result.reason as AppError).message).toMatch(/time slot is already booked|Selected time is not available/i);
      }
    });
  });

  it('allows concurrent requests for adjacent non-overlapping slots to both succeed', async () => {
    jest.spyOn(ReservationRepo, 'transaction').mockImplementation(async (fn: any) => fn({}));
    jest.spyOn(ReservationRepo, 'findGamingCenterBySlugWithSettings').mockImplementation(async () => {
      return { id: 'gc-test', slug: gamingCenterSlug, settings: { allowOnlineBooking: true, timeZone: 'UTC' } } as any;
    });
    jest.spyOn(ReservationRepo, 'findStation').mockImplementation(async () => {
      return { id: inputTemplate.stationId, name: 'PS5 Pro', defaultDurationHours: 1, hourlyPrice: 100, stationType: 'CONSOLE' } as any;
    });
    jest.spyOn(ReservationRepo, 'findStaff').mockImplementation(async () => ({ id: inputTemplate.staffId }) as any);
    jest.spyOn(ReservationRepo, 'findStaffShift').mockImplementation(async () => ({ id: 'shift-1', startTime: '08:00', endTime: '22:00' }) as any);
    jest.spyOn(ReservationRepo, 'findCustomerAccountByPhone').mockImplementation(async () => ({ id: 'ca-1', phone: '09121112233' }) as any);
    jest.spyOn(ReservationRepo, 'findCustomerProfile').mockImplementation(async () => ({ id: 'cp-1' }) as any);
    jest.spyOn(ReservationRepo, 'assertActiveReservationLimitNotExceeded').mockImplementation(async () => {});
    jest.spyOn(ReservationRepo, 'findOverlappingReservation').mockImplementation(async () => null);
    jest.spyOn(ReservationRepo, 'createReservation').mockImplementation(async (data: any) => ({
      id: `res-${Math.random()}`,
      ...data,
      status: ReservationStatus.PENDING,
    }) as any);

    const req1 = reservationStation.createPublicReservation(gamingCenterSlug, {
      ...inputTemplate,
      startTime: '2027-01-01T10:00:00.000Z', // 10:00 - 11:00
    });

    const req2 = reservationStation.createPublicReservation(gamingCenterSlug, {
      ...inputTemplate,
      startTime: '2027-01-01T11:00:00.000Z', // 11:00 - 12:00
    });

    const results = await Promise.all([req1, req2]);

    expect(results.length).toBe(2);
    expect(results[0].status).toBe(ReservationStatus.PENDING);
    expect(results[1].status).toBe(ReservationStatus.PENDING);
  });

  it('allows concurrent requests for different stations to both succeed', async () => {
    jest.spyOn(ReservationRepo, 'transaction').mockImplementation(async (fn: any) => fn({}));
    jest.spyOn(ReservationRepo, 'findGamingCenterBySlugWithSettings').mockImplementation(async () => {
      return { id: 'gc-test', slug: gamingCenterSlug, settings: { allowOnlineBooking: true, timeZone: 'UTC' } } as any;
    });
    jest.spyOn(ReservationRepo, 'findStation').mockImplementation(async (id: string) => {
      return { id, name: `Station ${id}`, defaultDurationHours: 1, hourlyPrice: 100, stationType: 'CONSOLE' } as any;
    });
    jest.spyOn(ReservationRepo, 'findStaff').mockImplementation(async () => ({ id: inputTemplate.staffId }) as any);
    jest.spyOn(ReservationRepo, 'findStaffShift').mockImplementation(async () => ({ id: 'shift-1', startTime: '08:00', endTime: '22:00' }) as any);
    jest.spyOn(ReservationRepo, 'findCustomerAccountByPhone').mockImplementation(async () => ({ id: 'ca-1', phone: '09121112233' }) as any);
    jest.spyOn(ReservationRepo, 'findCustomerProfile').mockImplementation(async () => ({ id: 'cp-1' }) as any);
    jest.spyOn(ReservationRepo, 'assertActiveReservationLimitNotExceeded').mockImplementation(async () => {});
    jest.spyOn(ReservationRepo, 'findOverlappingReservation').mockImplementation(async () => null);
    jest.spyOn(ReservationRepo, 'createReservation').mockImplementation(async (data: any) => ({
      id: `res-${Math.random()}`,
      ...data,
      status: ReservationStatus.PENDING,
    }) as any);

    const req1 = reservationStation.createPublicReservation(gamingCenterSlug, {
      ...inputTemplate,
      stationId: 'clx1234567890station01',
      startTime: '2027-01-01T14:00:00.000Z',
    });

    const req2 = reservationStation.createPublicReservation(gamingCenterSlug, {
      ...inputTemplate,
      stationId: 'clx1234567890station02',
      startTime: '2027-01-01T14:00:00.000Z',
    });

    const results = await Promise.all([req1, req2]);

    expect(results.length).toBe(2);
    expect(results[0].stationId).toBe('clx1234567890station01');
    expect(results[1].stationId).toBe('clx1234567890station02');
  });
});
