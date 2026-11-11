import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CustomerPanelStation } from '../../../../src/modules/customer-panel/customer-panel.station';
import { CustomerPanelRepo } from '../../../../src/modules/customer-panel/customer-panel.repo';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { walletService } from '../../../../src/modules/wallet/wallet.station';
import { auditService } from '../../../../src/modules/audit/audit.station';
import { updateCustomerProfileSchema } from '../../../../src/modules/customer-panel/customer-panel.validators';
import AppError from '../../../../src/common/errors/AppError';

describe('CustomerPanelStation updateProfile and validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateCustomerProfileSchema', () => {
    it('should validate valid fullName', () => {
      const parsed = updateCustomerProfileSchema.parse({
        body: {
          fullName: 'Ali Rezaei',
        },
      });
      expect(parsed.body.fullName).toBe('Ali Rezaei');
    });

    it('should reject extra/unauthorized properties like gamingCenterId or role', () => {
      expect(() => {
        updateCustomerProfileSchema.parse({
          body: {
            fullName: 'Ali Rezaei',
            gamingCenterId: 'gc-1234567890',
          },
        });
      }).toThrow();

      expect(() => {
        updateCustomerProfileSchema.parse({
          body: {
            role: 'MANAGER',
          },
        });
      }).toThrow();
    });

    it('should reject fullName if too short', () => {
      expect(() => {
        updateCustomerProfileSchema.parse({
          body: {
            fullName: 'A',
          },
        });
      }).toThrow();
    });
  });

  describe('CustomerPanelStation.updateProfile', () => {
    it('should throw NOT_FOUND if account does not exist', async () => {
      jest.spyOn(CustomerPanelRepo, 'findCustomerAccountById').mockResolvedValue(null);

      await expect(
        CustomerPanelStation.updateProfile('ca-not-found', { fullName: 'Ali' })
      ).rejects.toThrow(AppError);
    });

    it('should update customer profile successfully', async () => {
      const existingAccount = {
        id: 'ca-1',
        phone: '09121111111',
        fullName: 'Old Name',
        phoneVerifiedAt: new Date(),
        walletBalance: 1000,
        createdAt: new Date(),
        updatedAt: new Date(),
        profiles: [],
      };

      const updatedAccount = {
        ...existingAccount,
        fullName: 'New Name',
      };

      jest.spyOn(CustomerPanelRepo, 'findCustomerAccountById').mockResolvedValue(existingAccount as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const updateSpy = jest.spyOn(CustomerPanelRepo, 'updateCustomerAccount').mockResolvedValue(updatedAccount as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = await CustomerPanelStation.updateProfile('ca-1', { fullName: 'New Name' });

      expect(updateSpy).toHaveBeenCalledWith('ca-1', { fullName: 'New Name' });
      expect(result.fullName).toBe('New Name');
    });
  });

  describe('CustomerPanelStation.cancelReservation', () => {
    it('should allow customer to cancel when reservation start time is more than cancellationHours away', async () => {
      const now = new Date();
      const futureStartTime = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours in future
      const mockReservation = {
        id: 'res-1',
        customerAccountId: 'ca-1',
        gamingCenterId: 'gc-1',
        status: 'PENDING',
        startTime: futureStartTime,
        endTime: new Date(futureStartTime.getTime() + 2 * 60 * 60 * 1000),
        gamingCenter: {
          settings: {
            cancellationHours: 2,
          },
        },
      };

      const updatedReservation = {
        ...mockReservation,
        status: 'CANCELED',
        canceledAt: new Date(),
      };

      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValue(mockReservation as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      jest.spyOn(CustomerPanelRepo, 'transaction').mockImplementation(async (callback) => {
        return callback({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });
      jest.spyOn(ReservationRepo, 'createHistory').mockResolvedValue({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      jest.spyOn(walletService, 'refundReservationToWallet').mockResolvedValue({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      jest.spyOn(auditService, 'log').mockResolvedValue({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      jest.spyOn(CustomerPanelRepo, 'updateReservation').mockResolvedValue(updatedReservation as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = await CustomerPanelStation.cancelReservation('res-1', 'ca-1', 'Changed mind');
      expect(result.status).toBe('CANCELED');
    });

    it('should reject cancellation with CANCELLATION_DEADLINE_EXCEEDED when within cancellationHours window', async () => {
      const now = new Date();
      const nearStartTime = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour in future (< 2 hours)
      const mockReservation = {
        id: 'res-2',
        customerAccountId: 'ca-1',
        gamingCenterId: 'gc-1',
        status: 'CONFIRMED',
        startTime: nearStartTime,
        endTime: new Date(nearStartTime.getTime() + 2 * 60 * 60 * 1000),
        gamingCenter: {
          settings: {
            cancellationHours: 2,
          },
        },
      };

      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValue(mockReservation as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      await expect(
        CustomerPanelStation.cancelReservation('res-2', 'ca-1', 'Emergency')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'CANCELLATION_DEADLINE_EXCEEDED',
      });
    });
  });
});
