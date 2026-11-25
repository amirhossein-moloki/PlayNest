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

    const cancelableStatuses = [
      ReservationStatus.PENDING,
      ReservationStatus.CONFIRMED,
      ReservationStatus.IN_PROGRESS,
    ];

    expect(result?.status).toBe(ReservationStatus.CANCELED);
    expect(txMock.groupBooking.updateMany).toHaveBeenCalledWith({
      where: {
        id: groupBookingId,
        gamingCenterId,
        status: { in: cancelableStatuses },
      },
      data: {
        status: ReservationStatus.CANCELED,
        canceledAt: expect.any(Date),
        cancelReason: 'Customer canceled',
        canceledByUserId: null,
      },
    });
    expect(txMock.reservation.updateMany).toHaveBeenCalledWith({
      where: {
        groupBookingId,
        gamingCenterId,
        status: { in: cancelableStatuses },
      },
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

    const cancelableStatuses = [
      ReservationStatus.PENDING,
      ReservationStatus.CONFIRMED,
      ReservationStatus.IN_PROGRESS,
    ];

    expect(txMock.groupBooking.updateMany).toHaveBeenCalledWith({
      where: {
        id: groupBookingId,
        gamingCenterId,
        status: { in: cancelableStatuses },
      },
      data: {
        status: ReservationStatus.CANCELED,
        canceledAt: expect.any(Date),
        cancelReason: 'Staff canceled',
        canceledByUserId: 'u-staff-1',
      },
    });
    expect(txMock.reservation.updateMany).toHaveBeenCalledWith({
      where: {
        groupBookingId,
        gamingCenterId,
        status: { in: cancelableStatuses },
      },
      data: {
        status: ReservationStatus.CANCELED,
        canceledAt: expect.any(Date),
        cancelReason: 'Staff canceled',
        canceledByUserId: 'u-staff-1',
      },
    });
  });

  it('should return null without updating child reservations when groupBooking updateMany matches 0 rows', async () => {
    txMock.groupBooking.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await GroupBookingRepo.cancelGroupBookingAndReservations(
      groupBookingId,
      gamingCenterId,
      'u-staff-1',
      'Late cancel',
      txMock as any
    );

    expect(result).toBeNull();
    expect(txMock.reservation.updateMany).not.toHaveBeenCalled();
  });
});

describe('GroupBookingRepo.syncParentGroupBookingStatus', () => {
  it('syncs parent GroupBooking status to IN_PROGRESS, COMPLETED, NO_SHOW, and CANCELED based on children', async () => {
    const cases: Array<{ childStatuses: ReservationStatus[]; expected: ReservationStatus }> = [
      {
        childStatuses: [ReservationStatus.IN_PROGRESS, ReservationStatus.CONFIRMED],
        expected: ReservationStatus.IN_PROGRESS,
      },
      {
        childStatuses: [ReservationStatus.COMPLETED, ReservationStatus.CANCELED],
        expected: ReservationStatus.COMPLETED,
      },
      {
        childStatuses: [ReservationStatus.NO_SHOW, ReservationStatus.CANCELED],
        expected: ReservationStatus.NO_SHOW,
      },
      {
        childStatuses: [ReservationStatus.CANCELED, ReservationStatus.CANCELED],
        expected: ReservationStatus.CANCELED,
      },
    ];

    for (const c of cases) {
      const txMock = {
        reservation: {
          findMany: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(
            c.childStatuses.map((status) => ({ status }))
          ),
        },
        groupBooking: {
          updateMany: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ count: 1 }),
        },
      };

      await GroupBookingRepo.syncParentGroupBookingStatus('gb-sync-1', txMock as any);

      expect(txMock.groupBooking.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'gb-sync-1',
          status: { not: c.expected },
        },
        data: { status: c.expected },
      });
    }
  });
});
