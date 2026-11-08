import { describe, it, expect } from '@jest/globals';
import { updateSettingsSchema, getSettingsSchema } from '../../../../src/modules/settings/settings.validators';

describe('Settings Validators', () => {
  describe('updateSettingsSchema', () => {
    it('should validate a valid settings payload with operational fields', () => {
      const validPayload = {
        params: {
          gamingCenterId: 'gc-12345',
        },
        body: {
          allowOnlineBooking: true,
          onlineBookingAutoConfirm: false,
          preventOverlaps: true,
          workStartTime: '09:00',
          workEndTime: '23:30',
          timeZone: 'Asia/Tehran',
        },
      };

      const result = updateSettingsSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should validate openingTime and closingTime alias fields', () => {
      const payload = {
        params: {
          gamingCenterId: 'gc-center-1',
        },
        body: {
          openingTime: '10:00',
          closingTime: '22:00',
          timezone: 'UTC',
          maxAdvanceBookingDays: 14,
          minAdvanceBookingMinutes: 15,
        },
      };

      const result = updateSettingsSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should fail when workStartTime is not a valid HH:mm time string', () => {
      const invalidPayload = {
        params: {
          gamingCenterId: 'gc-123',
        },
        body: {
          workStartTime: '25:00',
        },
      };

      const result = updateSettingsSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should fail when allowOnlineBooking is not a boolean', () => {
      const invalidPayload = {
        params: {
          gamingCenterId: 'gc-123',
        },
        body: {
          allowOnlineBooking: 'not-a-boolean',
        },
      };

      const result = updateSettingsSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should fail when gamingCenterId is empty', () => {
      const invalidPayload = {
        params: {
          gamingCenterId: '',
        },
        body: {
          preventOverlaps: false,
        },
      };

      const result = updateSettingsSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('getSettingsSchema', () => {
    it('should pass with valid gamingCenterId', () => {
      const valid = {
        params: {
          gamingCenterId: 'gc-1',
        },
      };

      const result = getSettingsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should fail with empty gamingCenterId', () => {
      const invalid = {
        params: {
          gamingCenterId: '',
        },
      };

      const result = getSettingsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
