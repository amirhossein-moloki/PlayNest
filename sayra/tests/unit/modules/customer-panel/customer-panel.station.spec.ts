import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CustomerPanelStation } from '../../../../src/modules/customer-panel/customer-panel.station';
import { CustomerPanelRepo } from '../../../../src/modules/customer-panel/customer-panel.repo';
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
});
