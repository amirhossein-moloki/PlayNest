import { describe, it, expect } from '@jest/globals';
import {
  generateTrackingCode,
  normalizeTrackingCode,
  isValidTrackingCodeFormat,
  TRACKING_CODE_ALPHABET,
  TRACKING_CODE_LENGTH,
} from '../../../../src/common/utils/trackingCode';

describe('Tracking Code Generator Unit Tests', () => {
  it('should generate an 8-character string using only allowed safe alphabet characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateTrackingCode();
      expect(code).toHaveLength(TRACKING_CODE_LENGTH);
      for (const char of code) {
        expect(TRACKING_CODE_ALPHABET).toContain(char);
        expect(['0', 'O', '1', 'I', 'L'].includes(char)).toBe(false);
      }
    }
  });

  it('should generate unique codes across multiple calls', () => {
    const codes = new Set<string>();
    const count = 100;
    for (let i = 0; i < count; i++) {
      codes.add(generateTrackingCode());
    }
    expect(codes.size).toBe(count);
  });

  it('should normalize input consistently by converting to uppercase and stripping spaces/hyphens', () => {
    expect(normalizeTrackingCode('  trk-k7m9-p2r4  ')).toBe('TRKK7M9P2R4');
    expect(normalizeTrackingCode('k7m9p2r4')).toBe('K7M9P2R4');
    expect(normalizeTrackingCode('K7M9-P2R4')).toBe('K7M9P2R4');
    expect(normalizeTrackingCode('k7m9_p2r4!')).toBe('K7M9P2R4');
    expect(normalizeTrackingCode('')).toBe('');
  });

  it('should validate tracking code format correctly', () => {
    expect(isValidTrackingCodeFormat('K7M9P2R4')).toBe(true);
    expect(isValidTrackingCodeFormat('trk-k7m9-p2r4')).toBe(true);
    expect(isValidTrackingCodeFormat('')).toBe(false);
    expect(isValidTrackingCodeFormat('a')).toBe(false);
  });
});
