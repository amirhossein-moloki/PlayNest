import { parseSectionDataJson } from '../../../../src/modules/cms/section-data';
import { PageSectionType } from '@prisma/client';
import { describe, it, expect } from '@jest/globals';

describe('Section Data Parser', () => {
  it('should return null if dataJson is missing', () => {
    const result = parseSectionDataJson({ type: PageSectionType.HERO });
    expect(result).toBeNull();
  });

  it('should return null for unsupported section type', () => {
    const result = parseSectionDataJson({ type: 'INVALID', dataJson: '{}' });
    expect(result).toBeNull();
  });

  it('should parse and validate valid HERO data', () => {
    const data = {
      headline: 'Welcome',
      subheadline: 'Sub',
      primaryCta: { label: 'Go', url: '/' },
      secondaryCta: { label: 'Back', url: '/' },
      backgroundImageUrl: 'http://img.com'
    };
    const result = parseSectionDataJson({
      type: PageSectionType.HERO,
      dataJson: JSON.stringify(data)
    });
    expect(result).toEqual(data);
  });

  it('should return null for invalid JSON', () => {
    const result = parseSectionDataJson({
      type: PageSectionType.HERO,
      dataJson: 'invalid'
    });
    expect(result).toBeNull();
  });
});
