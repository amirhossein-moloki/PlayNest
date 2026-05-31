import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';
import { reservationsService } from '../../src/modules/reservations/reservations.station';
import { ReservationsRepo } from '../../src/modules/reservations/reservations.repo';

// For Reservations, we use repository mocks because of SQLite JSON transaction issues,
// but keep the flow end-to-end in the service.
jest.mock('../../src/modules/reservations/reservations.repo');
const MockedRepo = ReservationsRepo as jest.Mocked<typeof ReservationsRepo>;

describe('Reservation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockedRepo.transaction.mockImplementation(async (cb) => cb({}));
  });

  it('should create a reservation successfully', async () => {
    const input = {
      gamingCenterId: 'gc-1', stationId: 'st-1', staffId: 'u-1',
      createdByUserId: 'u-1', customer: { fullName: 'JD', phone: '0912' },
      startTime: new Date().toISOString(),
      note: '',
    };
    MockedRepo.findStation.mockResolvedValue({ id: 'st-1', defaultDurationHours: 1, hourlyPrice: 100 } as any);
    MockedRepo.findStaff.mockResolvedValue({ id: 'u-1' } as any);
    MockedRepo.findCustomerAccountByPhone.mockResolvedValue({ id: 'c-1' } as any);
    MockedRepo.findCustomerProfile.mockResolvedValue({ id: 'cp-1' } as any);
    MockedRepo.findGamingCenterWithSettings.mockResolvedValue({ id: 'gc-1' } as any);
    MockedRepo.createReservation.mockResolvedValue({ id: 'res-1' } as any);

    const result = await reservationsService.createBooking(input);
    expect(result.id).toBe('res-1');
    expect(MockedRepo.createReservation).toHaveBeenCalled();
  });
});
