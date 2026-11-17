import { describe, it, expect } from '@jest/globals';
import {
  idSchema,
  idParamSchema,
  isValidId,
  ID_REGEX,
} from '../../../../src/common/validators/common.validators';

describe('ID Validation Contract', () => {
  describe('isValidId and ID_REGEX', () => {
    it('should validate standard CUIDv1 identifiers', () => {
      const cuidV1 = 'cjld2cjxh0000qzrmn831i7rn';
      expect(isValidId(cuidV1)).toBe(true);
      expect(idSchema().safeParse(cuidV1).success).toBe(true);
    });

    it('should validate CUIDv2 identifiers', () => {
      const cuidV2 = 'tz4a98xxat96iws9zmbrgj3a';
      expect(isValidId(cuidV2)).toBe(true);
      expect(idSchema().safeParse(cuidV2).success).toBe(true);
    });

    it('should validate UUIDv4 identifiers', () => {
      const uuidV4 = '123e4567-e89b-12d3-a456-426614174000';
      expect(isValidId(uuidV4)).toBe(true);
      expect(idSchema().safeParse(uuidV4).success).toBe(true);
    });

    it('should validate legacy/seed dataset identifiers', () => {
      const seedIds = [
        'center_07',
        'reservation_07_007',
        'station_07_001',
        'session_07_001',
        'user_07_admin',
        'gc-1',
        'res-pending',
      ];
      for (const id of seedIds) {
        expect(isValidId(id)).toBe(true);
        expect(idSchema().safeParse(id).success).toBe(true);
      }
    });

    it('should reject empty strings', () => {
      expect(isValidId('')).toBe(false);
      const res = idSchema().safeParse('');
      expect(res.success).toBe(false);
    });

    it('should reject strings containing whitespace', () => {
      expect(isValidId('center 07')).toBe(false);
      expect(isValidId(' center_07')).toBe(false);
      expect(isValidId('center_07 ')).toBe(false);
      expect(isValidId('center\t07')).toBe(false);
    });

    it('should reject strings with invalid characters / injection attempts', () => {
      const invalid = [
        '<script>alert(1)</script>',
        'center_07; DROP TABLE users;',
        'center/07',
        'center?id=1',
        'center:07',
        'center@07',
        'center#07',
        'center!07',
        '🎮station',
      ];
      for (const id of invalid) {
        expect(isValidId(id)).toBe(false);
        expect(idSchema().safeParse(id).success).toBe(false);
      }
    });

    it('should reject strings exceeding 128 characters', () => {
      const tooLong = 'a'.repeat(129);
      expect(isValidId(tooLong)).toBe(false);
      expect(idSchema().safeParse(tooLong).success).toBe(false);

      const maxAllowed = 'a'.repeat(128);
      expect(isValidId(maxAllowed)).toBe(true);
      expect(idSchema().safeParse(maxAllowed).success).toBe(true);
    });
  });

  describe('idParamSchema', () => {
    const paramsSchema = idParamSchema('gamingCenterId');

    it('should validate object containing valid param name inside params', () => {
      const result = paramsSchema.safeParse({ params: { gamingCenterId: 'center_07' } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.params.gamingCenterId).toBe('center_07');
      }
    });

    it('should fail when param is missing', () => {
      const result = paramsSchema.safeParse({ params: {} });
      expect(result.success).toBe(false);
    });

    it('should fail when param has invalid format', () => {
      const result = paramsSchema.safeParse({ params: { gamingCenterId: 'center 07' } });
      expect(result.success).toBe(false);
    });

    it('should support custom error message in idSchema', () => {
      const customSchema = idSchema('Custom invalid ID error');
      const result = customSchema.safeParse('invalid id!');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Custom invalid ID error');
      }
    });
  });
});
