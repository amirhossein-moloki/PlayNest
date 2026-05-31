import { describe, it, expect } from '@jest/globals';
import { normalizePhone } from '../../../../src/common/utils/phone';

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
  });
});
