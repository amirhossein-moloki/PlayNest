import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CancellationActor, CancellationCategory, ReservationStatus } from '@prisma/client';
import { GroupBookingRepo } from '../../../../src/modules/group-booking/group-booking.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('GroupBookingRepo.cancelGroupBookingAndReservations', () => {
  const groupBookingId = 'gb-123';
  const gamingCenterId = 'gc-1';

  let txMock: {
    groupBooking: {
      updateMany: jest.Mock<(...args: any[]) => Promise<any>>;
      findFirst: jest.Mock<(...args: any[]) => Promise<any>>;
    };
    reservation: {
      updateMany: jest.Mock<(...args: any[]) => Promise<any>>;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    txMock = {
      groupBooking: {
        updateMany: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
          id: groupBookingId,
          gamingCenterId,
          status: ReservationStatus.CANCELED,
        }),
      },
      reservation: {
        updateMany: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ count: 2 }),
      },
    };
  });

  it('should persist canceledByUserId=null and cancellation metadata when canceledByUserId is null', async () => {
    const result = await GroupBookingRepo.cancelGroupBookingAndReservations(
      groupBookingId,
      gamingCenterId,
      null,
      'Customer canceled',
      txMock as any,
      {
        cancelCategory: CancellationCategory.CUSTOMER_CANCEL,
        cancelActor: CancellationActor.CUSTOMER,
      }
    );

    expect(result?.status).toBe(ReservationStatus.CANCELED);
    expect(txMock.groupBooking.updateMany).toHaveBeenCalledWith({
      where: { id: groupBookingId, gamingCenterId },
      data: {
        status: ReservationStatus.CANCELED,
        canceledAt: expect.any(Date),
        cancelReason: 'Customer canceled',
        canceledByUserId: null,
      },
    });
    expect(txMock.reservation.updateMany).toHaveBeenCalledWith({
      where: { groupBookingId, gamingCenterId },
      data: {
        status: ReservationStatus.CANCELED,
        canceledAt: expect.any(Date),
        cancelReason: 'Customer canceled',
        canceledByUserId: null,
        cancelCategory: CancellationCategory.CUSTOMER_CANCEL,
        cancelActor: CancellationActor.CUSTOMER,
      },
    });
  });

  it('should persist canceledByUserId when a staff user ID is provided', async () => {
    await GroupBookingRepo.cancelGroupBookingAndReservations(
      groupBookingId,
      gamingCenterId,
      'u-staff-1',
      'Staff canceled',
      txMock as any
    );

    expect(txMock.groupBooking.updateMany).toHaveBeenCalledWith({
      where: { id: groupBookingId, gamingCenterId },
      data: {
        status: ReservationStatus.CANCELED,
        canceledAt: expect.any(Date),
        cancelReason: 'Staff canceled',
        canceledByUserId: 'u-staff-1',
      },
    });
    expect(txMock.reservation.updateMany).toHaveBeenCalledWith({
      where: { groupBookingId, gamingCenterId },
      data: {
        status: ReservationStatus.CANCELED,
        canceledAt: expect.any(Date),
        cancelReason: 'Staff canceled',
        canceledByUserId: 'u-staff-1',
      },
    });
  });
});
