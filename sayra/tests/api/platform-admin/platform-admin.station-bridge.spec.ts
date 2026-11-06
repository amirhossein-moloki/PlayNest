/* eslint-disable @typescript-eslint/no-explicit-any */
import { AdminStationBridge } from '../../../src/platform-admin/services/admin-station-bridge';
import { AdminAuditService } from '../../../src/platform-admin/services/admin-audit.service';
import { reservationStation } from '../../../src/modules/reservation/reservation.station';
import { RefundsStation } from '../../../src/modules/payments/payments.refund.station';
import { VerificationStation } from '../../../src/modules/verification/verification.station';
import { auditService } from '../../../src/modules/audit/audit.station';

jest.mock('../../../src/modules/reservation/reservation.station', () => ({
  reservationStation: {
    cancelReservation: jest.fn(),
  },
}));

jest.mock('../../../src/modules/payments/payments.refund.station', () => ({
  RefundsStation: {
    requestRefund: jest.fn(),
  },
}));

jest.mock('../../../src/modules/verification/verification.station', () => ({
  VerificationStation: {
    approveVerification: jest.fn(),
    rejectVerification: jest.fn(),
  },
}));

jest.mock('../../../src/modules/audit/audit.station', () => ({
  auditService: {
    recordLog: jest.fn(),
  },
}));

describe('AdminStationBridge and AdminAuditService Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const adminContext = {
    platformAdminId: 'pa_super_1',
    ipAddress: '127.0.0.1',
    userAgent: 'JestTestRunner/1.0',
  };

  it('AdminStationBridge.cancelReservation delegates to reservationStation and logs audit', async () => {
    (reservationStation.cancelReservation as jest.Mock).mockResolvedValue({
      id: 'res_123',
      status: 'CANCELED',
    });

    const result = await AdminStationBridge.cancelReservation(
      'gc_1',
      'res_123',
      'Customer requested cancellation via call',
      adminContext
    );

    expect(reservationStation.cancelReservation).toHaveBeenCalledWith(
      'res_123',
      'gc_1',
      expect.objectContaining({ id: 'pa_super_1' }),
      expect.objectContaining({ reason: expect.stringContaining('Customer requested cancellation') }),
      expect.any(Object)
    );
    expect(auditService.recordLog).toHaveBeenCalledWith(
      expect.objectContaining({
        platformAdminId: 'pa_super_1',
        action: 'ADMIN_RESERVATION_CANCELLED',
        entity: 'Reservation',
        entityId: 'res_123',
      })
    );
    expect(result.status).toBe('CANCELED');
  });

  it('AdminStationBridge.processRefund delegates to RefundsStation and logs audit', async () => {
    (RefundsStation.requestRefund as jest.Mock).mockResolvedValue({
      id: 'ref_999',
      status: 'PENDING',
      amount: 150000,
    });

    const result = await AdminStationBridge.processRefund(
      {
        gamingCenterId: 'gc_1',
        paymentId: 'pay_777',
        amount: 150000,
        currency: 'IRR',
        reason: 'Service issue reported',
      },
      adminContext
    );

    expect(RefundsStation.requestRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        gamingCenterId: 'gc_1',
        paymentId: 'pay_777',
        amount: 150000,
        requestedById: 'pa_super_1',
      })
    );
    expect(auditService.recordLog).toHaveBeenCalledWith(
      expect.objectContaining({
        platformAdminId: 'pa_super_1',
        action: 'ADMIN_REFUND_PROCESSED',
        entity: 'Refund',
        entityId: 'ref_999',
      })
    );
    expect(result.id).toBe('ref_999');
  });

  it('AdminStationBridge.decideVerification approves KYC and logs audit', async () => {
    (VerificationStation.approveVerification as jest.Mock).mockResolvedValue({
      id: 'ver_555',
      status: 'APPROVED',
    });

    const result = await AdminStationBridge.decideVerification('ver_555', true, 'Documents verified', adminContext);

    expect(VerificationStation.approveVerification).toHaveBeenCalledWith(
      'ver_555',
      'pa_super_1',
      expect.objectContaining({ id: 'pa_super_1' }),
      expect.any(Object)
    );
    expect(auditService.recordLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ADMIN_VERIFICATION_APPROVED',
        entityId: 'ver_555',
      })
    );
    expect(result.status).toBe('APPROVED');
  });

  it('AdminAuditService strips sensitive keys like password, tokens, otp from audit payloads', async () => {
    await AdminAuditService.logAdminEvent({
      platformAdminId: 'pa_super_1',
      action: 'UPDATE_CREDENTIALS',
      entity: 'PlatformAdmin',
      entityId: 'pa_target',
      oldData: { passwordHash: '$argon2id$secret', username: 'admin1', token: 'jwt.token' },
      newData: { passwordHash: '$argon2id$new_secret', otp: '123456', username: 'admin2' },
    });

    expect(auditService.recordLog).toHaveBeenCalledWith(
      expect.objectContaining({
        oldData: {
          passwordHash: '[REDACTED]',
          token: '[REDACTED]',
          username: 'admin1',
        },
        newData: {
          passwordHash: '[REDACTED]',
          otp: '[REDACTED]',
          username: 'admin2',
        },
      })
    );
  });
});
