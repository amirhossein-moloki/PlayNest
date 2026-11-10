import { describe, it, expect } from '@jest/globals';
import { normalizePhone, getPhoneVariants } from '../../../../src/common/utils/phone';

describe('phone utility', () => {
  describe('normalizePhone', () => {
    it('should normalize Iranian phone numbers starting with 0', () => {
      expect(normalizePhone('09123456789')).toBe('+989123456789');
    });

    it('should normalize phone numbers already starting with +', () => {
      expect(normalizePhone('+989123456789')).toBe('+989123456789');
      expect(normalizePhone('+1234567890')).toBe('+1234567890');
    });

    it('should normalize phone numbers starting with 00', () => {
      expect(normalizePhone('00989123456789')).toBe('+989123456789');
    });

    it('should handle spaces and non-digit characters', () => {
      expect(normalizePhone(' 0912 345 6789 ')).toBe('+989123456789');
      expect(normalizePhone('+98-912-345-6789')).toBe('+989123456789');
    });

    it('should prepend + to digits if no other rule matches', () => {
      expect(normalizePhone('989123456789')).toBe('+989123456789');
    });

    it('should normalize 10-digit Iranian phone number starting with 9', () => {
      expect(normalizePhone('9123456789')).toBe('+989123456789');
    });
  });

  describe('getPhoneVariants', () => {
    it('should return all representations for an Iranian mobile number', () => {
      const variants = getPhoneVariants('09123456789');
      expect(variants).toContain('+989123456789');
      expect(variants).toContain('09123456789');
      expect(variants).toContain('989123456789');
      expect(variants).toContain('00989123456789');
      expect(variants).toContain('9123456789');
    });

    it('should return variants when called with international format', () => {
      const variants = getPhoneVariants('+989123456789');
      expect(variants).toContain('+989123456789');
      expect(variants).toContain('09123456789');
      expect(variants).toContain('989123456789');
    });
  });
});
