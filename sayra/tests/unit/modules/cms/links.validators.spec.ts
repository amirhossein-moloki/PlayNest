import { describe, it, expect, jest } from '@jest/globals';
import {
  createLinkSchema,
  updateLinkSchema,
} from '../../../../src/modules/cms/links.validators';
import { LinkType } from '@prisma/client';
import { validate } from '../../../../src/common/middleware/validate';
import { Request, Response } from 'express';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Links Validators', () => {
  describe('createLinkSchema', () => {
    it('should validate a valid link creation payload successfully', async () => {
      const validPayload = {
        body: {
          type: LinkType.INSTAGRAM,
          label: 'صفحه اینستاگرام',
          value: 'https://instagram.com/mycenter',
          isPrimary: true,
          isActive: true,
        },
      };

      const parsed = await createLinkSchema.parseAsync(validPayload);
      expect(parsed.body.type).toBe(LinkType.INSTAGRAM);
      expect(parsed.body.label).toBe('صفحه اینستاگرام');
      expect(parsed.body.value).toBe('https://instagram.com/mycenter');
      expect(parsed.body.isPrimary).toBe(true);
      expect(parsed.body.isActive).toBe(true);
    });

    it('should allow optional fields to be omitted in createLinkSchema', async () => {
      const minimalPayload = {
        body: {
          type: LinkType.WEBSITE,
          value: 'https://example.com',
        },
      };

      const parsed = await createLinkSchema.parseAsync(minimalPayload);
      expect(parsed.body.type).toBe(LinkType.WEBSITE);
      expect(parsed.body.value).toBe('https://example.com');
      expect(parsed.body.label).toBeUndefined();
      expect(parsed.body.isPrimary).toBeUndefined();
      expect(parsed.body.isActive).toBeUndefined();
    });

    it('should reject link creation when type is invalid enum value', async () => {
      const invalidPayload = {
        body: {
          type: 'INVALID_TYPE',
          value: 'https://example.com',
        },
      };

      await expect(createLinkSchema.parseAsync(invalidPayload)).rejects.toThrow();
    });

    it('should reject link creation when value is empty string', async () => {
      const emptyValuePayload = {
        body: {
          type: LinkType.TELEGRAM,
          value: '',
        },
      };

      await expect(createLinkSchema.parseAsync(emptyValuePayload)).rejects.toThrow();
    });

    it('should reject link creation when value is missing', async () => {
      const missingValuePayload = {
        body: {
          type: LinkType.TELEGRAM,
        },
      };

      await expect(createLinkSchema.parseAsync(missingValuePayload)).rejects.toThrow();
    });
  });

  describe('updateLinkSchema', () => {
    it('should validate a valid partial PATCH payload', async () => {
      const partialPayload = {
        body: {
          value: 'https://telegram.me/newchannel',
        },
      };

      const parsed = await updateLinkSchema.parseAsync(partialPayload);
      expect(parsed.body.value).toBe('https://telegram.me/newchannel');
      expect(parsed.body.type).toBeUndefined();
    });

    it('should allow partial update of isPrimary and isActive', async () => {
      const partialPayload = {
        body: {
          isPrimary: false,
          isActive: false,
        },
      };

      const parsed = await updateLinkSchema.parseAsync(partialPayload);
      expect(parsed.body.isPrimary).toBe(false);
      expect(parsed.body.isActive).toBe(false);
    });

    it('should reject invalid enum type in partial update', async () => {
      const invalidPayload = {
        body: {
          type: 'NOT_A_LINK_TYPE',
        },
      };

      await expect(updateLinkSchema.parseAsync(invalidPayload)).rejects.toThrow();
    });
  });

  describe('validate middleware integration', () => {
    it('should pass valid link payload through validate middleware', async () => {
      const middleware = validate(createLinkSchema);
      const req = {
        body: {
          type: LinkType.WHATSAPP,
          value: '+989123456789',
        },
        query: {},
        params: { gamingCenterId: 'gc-1' },
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn();

      await middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.body.type).toBe(LinkType.WHATSAPP);
      expect(req.body.value).toBe('+989123456789');
    });

    it('should forward validation error to next() on invalid link payload', async () => {
      const middleware = validate(createLinkSchema);
      const req = {
        body: {
          type: 'INVALID',
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
