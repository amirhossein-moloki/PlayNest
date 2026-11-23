import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SessionActorType } from '@prisma/client';
import { auditService } from '../../../../src/modules/audit/audit.station';
import { AuditRepo } from '../../../../src/modules/audit/audit.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('auditService.log', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('should populate userId for SessionActorType.USER actors', async () => {
    const createLogSpy = jest.spyOn(AuditRepo, 'createLog').mockResolvedValue({ id: 'log-1' } as any);

    await auditService.log(
      'gc-1',
      { id: 'u-1', actorType: SessionActorType.USER },
      'RESERVATION_CANCEL',
      { name: 'Reservation', id: 'res-1' },
      { new: { status: 'CANCELED' } }
    );

    expect(createLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        gamingCenterId: 'gc-1',
        userId: 'u-1',
        customerId: undefined,
        platformAdminId: undefined,
        action: 'RESERVATION_CANCEL',
        entity: 'Reservation',
        entityId: 'res-1',
      })
    );
  });

  it('should populate customerId for SessionActorType.CUSTOMER actors', async () => {
    const createLogSpy = jest.spyOn(AuditRepo, 'createLog').mockResolvedValue({ id: 'log-2' } as any);

    await auditService.log(
      'gc-1',
      { id: 'ca-1', actorType: SessionActorType.CUSTOMER },
      'GROUP_BOOKING_CANCEL',
      { name: 'GroupBooking', id: 'gb-1' },
      { new: { status: 'CANCELED' } }
    );

    expect(createLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        gamingCenterId: 'gc-1',
        userId: undefined,
        customerId: 'ca-1',
        platformAdminId: undefined,
        action: 'GROUP_BOOKING_CANCEL',
        entity: 'GroupBooking',
        entityId: 'gb-1',
      })
    );
  });

  it('should populate platformAdminId for SessionActorType.PLATFORM_ADMIN actors', async () => {
    const createLogSpy = jest.spyOn(AuditRepo, 'createLog').mockResolvedValue({ id: 'log-3' } as any);

    await auditService.log(
      'gc-1',
      { id: 'pa-1', actorType: SessionActorType.PLATFORM_ADMIN },
      'SALON_UPDATE',
      { name: 'GamingCenterVerification', id: 'ver-1' },
      { new: { status: 'APPROVED' } }
    );

    expect(createLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        gamingCenterId: 'gc-1',
        userId: undefined,
        customerId: undefined,
        platformAdminId: 'pa-1',
        action: 'SALON_UPDATE',
        entity: 'GamingCenterVerification',
        entityId: 'ver-1',
      })
    );
  });
});
