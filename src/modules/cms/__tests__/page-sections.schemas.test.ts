import { PageSectionType } from '@prisma/client';
import { validateSectionData } from '../page-sections.schemas';

describe('page section schemas', () => {
  const validSectionPayloads: Record<PageSectionType, unknown> = {
    [PageSectionType.HERO]: {
      headline: 'عنوان اصلی',
      subheadline: 'زیرعنوان',
      primaryCta: { label: 'رزرو نوبت', url: '/reservation' },
      secondaryCta: { label: 'خدمات', url: '/stations' },
      backgroundImageUrl: 'https://picsum.photos/seed/hero/1600/900',
    },
    [PageSectionType.HIGHLIGHTS]: {
      title: 'چرا ما؟',
      items: [
        { title: 'محیط بهداشتی', text: 'متن' },
        { title: 'پرسنل حرفه‌ای', text: 'متن' },
      ],
    },
    [PageSectionType.SERVICES_GRID]: {
      title: 'خدمات پرطرفدار',
      showPrices: true,
      maxItems: 12,
    },
    [PageSectionType.GALLERY_GRID]: {
      title: 'گالری',
      categories: ['مو', 'ناخن'],
      limit: 12,
    },
    [PageSectionType.TESTIMONIALS]: {
      title: 'نظرات مشتریان',
      limit: 6,
    },
    [PageSectionType.FAQ]: {
      title: 'سوالات پرتکرار',
      items: [
        { q: 'سوال ۱', a: 'پاسخ ۱' },
        { q: 'سوال ۲', a: 'پاسخ ۲' },
      ],
    },
    [PageSectionType.CTA]: {
      title: 'برای تغییر استایل آماده‌اید؟',
      text: 'همین الان نوبت خود را رزرو کنید.',
      buttonLabel: 'رزرو نوبت',
      buttonUrl: '/reservation',
    },
    [PageSectionType.CONTACT_CARD]: {
      title: 'اطلاعات تماس',
      city: 'تهران',
      workHours: '09:00 تا 20:00',
    },
    [PageSectionType.MAP]: {
      lat: 35.6892,
      lng: 51.389,
      zoom: 14,
    },
    [PageSectionType.RICH_TEXT]: {
      title: 'درباره ما',
      blocks: [
        { type: 'paragraph', text: 'متن ساده' },
        { type: 'paragraph', text: 'متن بیشتر' },
      ],
    },
    [PageSectionType.STAFF_GRID]: {
      title: 'تیم ما',
      showRoles: true,
      showBio: true,
    },
  };

  it.each(Object.entries(validSectionPayloads))('accepts valid %s payloads', (type, payload) => {
    expect(() => validateSectionData(type as PageSectionType, JSON.stringify(payload))).not.toThrow();
  });

  it('strips HTML in rich text blocks by default', () => {
    const payload = {
      title: 'قوانین',
      blocks: [{ type: 'paragraph', text: '<p>HTML متن</p>' }],
    };

    const parsed = validateSectionData(PageSectionType.RICH_TEXT, JSON.stringify(payload)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(parsed.blocks[0].text).toBe('HTML متن');
  });

  it('allows safe HTML in rich text blocks when explicitly allowed', () => {
    const payload = {
      title: 'قوانین',
      blocks: [{ type: 'paragraph', text: 'متن <strong>پررنگ</strong>', allowHtml: true }],
    };

    const parsed = validateSectionData(PageSectionType.RICH_TEXT, JSON.stringify(payload)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(parsed.blocks[0].text).toBe('متن <strong>پررنگ</strong>');
  });

  it('sanitizes XSS payloads in rich text blocks', () => {
    const payload = {
      title: 'امنیت',
      blocks: [
        {
          type: 'paragraph',
          text: '<img src=x onerror=alert(1)>Hello<script>alert(2)</script><a href="javascript:alert(3)">bad</a><strong>ok</strong>',
          allowHtml: true,
        },
        {
          type: 'paragraph',
          text: '<svg onload=alert(4)>SVG</svg>Plain',
        },
      ],
    };

    const parsed = validateSectionData(PageSectionType.RICH_TEXT, JSON.stringify(payload)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(parsed.blocks[0].text).toContain('Hello');
    expect(parsed.blocks[0].text).toContain('<strong>ok</strong>');
    expect(parsed.blocks[0].text).toContain('<a>bad</a>');
    expect(parsed.blocks[0].text).not.toContain('script');
    expect(parsed.blocks[0].text).not.toContain('onerror');
    expect(parsed.blocks[0].text).not.toContain('javascript:');
    expect(parsed.blocks[1].text).toBe('SVGPlain');
  });
});
