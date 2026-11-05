import { describe, it, expect, jest } from '@jest/globals';
import {
  createAddressSchema,
  updateAddressSchema,
} from '../../../../src/modules/cms/addresses.validators';
import { validate } from '../../../../src/common/middleware/validate';
import { Request, Response } from 'express';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Addresses Validators', () => {
  describe('createAddressSchema', () => {
    it('should validate a valid address creation payload successfully', async () => {
      const validPayload = {
        body: {
          city: 'رشت',
          addressLine: 'آدرس واردشده توسط کاربر',
          province: 'گیلان',
          lat: 37.2809,
          lng: 49.5924,
        },
      };

      const parsed = await createAddressSchema.parseAsync(validPayload);
      expect(parsed.body.city).toBe('رشت');
      expect(parsed.body.addressLine).toBe('آدرس واردشده توسط کاربر');
      expect(parsed.body.province).toBe('گیلان');
      expect(parsed.body.lat).toBe(37.2809);
      expect(parsed.body.lng).toBe(49.5924);
    });

    it('should allow optional fields to be omitted', async () => {
      const minimalPayload = {
        body: {
          city: 'تهران',
          addressLine: 'خیابان آزادی',
        },
      };

      const parsed = await createAddressSchema.parseAsync(minimalPayload);
      expect(parsed.body.city).toBe('تهران');
      expect(parsed.body.addressLine).toBe('خیابان آزادی');
      expect(parsed.body.province).toBeUndefined();
      expect(parsed.body.lat).toBeUndefined();
      expect(parsed.body.lng).toBeUndefined();
      expect(parsed.body.title).toBeUndefined();
      expect(parsed.body.isPrimary).toBeUndefined();
    });

    it('should reject payload when city is missing', async () => {
      const payloadWithoutCity = {
        body: {
          addressLine: 'خیابان آزادی',
        },
      };

      await expect(createAddressSchema.parseAsync(payloadWithoutCity)).rejects.toThrow();
    });

    it('should reject payload when city is empty string', async () => {
      const payloadWithEmptyCity = {
        body: {
          city: '',
          addressLine: 'خیابان آزادی',
        },
      };

      await expect(createAddressSchema.parseAsync(payloadWithEmptyCity)).rejects.toThrow();
    });

    it('should reject payload when addressLine is missing', async () => {
      const payloadWithoutAddress = {
        body: {
          city: 'تهران',
        },
      };

      await expect(createAddressSchema.parseAsync(payloadWithoutAddress)).rejects.toThrow();
    });

    it('should reject payload with invalid data types', async () => {
      const payloadWithInvalidTypes = {
        body: {
          city: 123,
          addressLine: 'خیابان آزادی',
          lat: 'not-a-number',
        },
      };

      await expect(createAddressSchema.parseAsync(payloadWithInvalidTypes)).rejects.toThrow();
    });
  });

  describe('updateAddressSchema', () => {
    it('should validate a valid partial PATCH payload', async () => {
      const partialPayload = {
        body: {
          city: 'شیراز',
        },
      };

      const parsed = await updateAddressSchema.parseAsync(partialPayload);
      expect(parsed.body.city).toBe('شیراز');
      expect(parsed.body.addressLine).toBeUndefined();
    });

    it('should allow empty update payload if all fields are optional', async () => {
      const emptyPayload = {
        body: {},
      };

      const parsed = await updateAddressSchema.parseAsync(emptyPayload);
      expect(parsed.body).toEqual({});
    });

    it('should reject invalid field values on update', async () => {
      const invalidPayload = {
        body: {
          lat: 'invalid-number',
        },
      };

      await expect(updateAddressSchema.parseAsync(invalidPayload)).rejects.toThrow();
    });
  });

  describe('validate middleware integration', () => {
    it('should pass request data wrapped in body/query/params to createAddressSchema', async () => {
      const middleware = validate(createAddressSchema);
      const req = {
        body: {
          city: 'رشت',
          addressLine: 'آدرس تست',
          province: 'گیلان',
          lat: 37.28,
          lng: 49.59,
        },
        query: {},
        params: { gamingCenterId: 'gc-1' },
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn();

      await middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.body.city).toBe('رشت');
      expect(req.body.addressLine).toBe('آدرس تست');
    });

    it('should call next with validation error when required field is missing in middleware', async () => {
      const middleware = validate(createAddressSchema);
      const req = {
        body: {
          province: 'گیلان',
        },
        query: {},
        params: { gamingCenterId: 'gc-1' },
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn();

      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0] as any;
      expect(err).toBeDefined();
      expect(err.name).toBe('ZodError');
    });
  });
});
