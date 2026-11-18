import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { generateUniqueCheckInCode } from '../../../../src/modules/reservation/reservation.code';
import { reservationStation } from '../../../../src/modules/reservation/reservation.station';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { UserRole } from '@prisma/client';

jest.mock('../../../../src/modules/reservation/reservation.repo');

const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Reservation checkInCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateUniqueCheckInCode', () => {
    it('should generate a 5-digit numeric code when no collision exists', async () => {
      const mockClient = {
        reservation: {
          findFirst: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(null),
        },
      };

      const code = await generateUniqueCheckInCode('gc-1', mockClient as any);
      expect(code).toMatch(/^\d{5}$/);
      expect(mockClient.reservation.findFirst).toHaveBeenCalledTimes(1);
      expect(mockClient.reservation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gamingCenterId: 'gc-1',
            checkInCode: code,
          }),
        })
      );
    });

    it('should retry on collision and return a non-colliding 5-digit code', async () => {
      const mockClient = {
        reservation: {
          findFirst: jest
            .fn<() => Promise<any>>()
            .mockResolvedValueOnce({ id: 'res-existing' })
            .mockResolvedValueOnce(null),
        },
      };

      const code = await generateUniqueCheckInCode('gc-1', mockClient as any);
      expect(code).toMatch(/^\d{5}$/);
      expect(mockClient.reservation.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('manager reservation search by checkInCode and search', () => {
    it('should filter by exact checkInCode when provided', async () => {
      MockedReservationRepo.transaction.mockImplementation(async (fn: any) => fn({}));
      MockedReservationRepo.findManyReservation.mockResolvedValue([
        { id: 'res-1', checkInCode: '48291' } as any,
      ]);
      MockedReservationRepo.countReservation.mockResolvedValue(1);

      const result = await reservationStation.getReservation(
        'gc-1',
        { checkInCode: '48291' },
        { id: 'mgr-1', role: UserRole.MANAGER }
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].checkInCode).toBe('48291');
      expect(MockedReservationRepo.findManyReservation).toHaveBeenCalledWith(
        expect.objectContaining({
          gamingCenterId: 'gc-1',
          checkInCode: '48291',
        }),
        0,
        20,
        { startTime: 'asc' },
        expect.anything()
      );
    });

    it('should search across checkInCode, customer name, phone, and id when search is provided', async () => {
      MockedReservationRepo.transaction.mockImplementation(async (fn: any) => fn({}));
      MockedReservationRepo.findManyReservation.mockResolvedValue([]);
      MockedReservationRepo.countReservation.mockResolvedValue(0);

      await reservationStation.getReservation(
        'gc-1',
        { search: '48291' },
        { id: 'mgr-1', role: UserRole.MANAGER }
      );

      expect(MockedReservationRepo.findManyReservation).toHaveBeenCalledWith(
        expect.objectContaining({
          gamingCenterId: 'gc-1',
          OR: [
            { checkInCode: { contains: '48291', mode: 'insensitive' } },
            { customerProfile: { displayName: { contains: '48291', mode: 'insensitive' } } },
            { customerAccount: { fullName: { contains: '48291', mode: 'insensitive' } } },
            { customerAccount: { phone: { contains: '48291' } } },
            { id: { contains: '48291', mode: 'insensitive' } },
          ],
        }),
        0,
        20,
        { startTime: 'asc' },
        expect.anything()
      );
    });
  });
});
