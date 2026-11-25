
import { z } from 'zod';
import { PageSectionType } from '@prisma/client';
import { FilterXSS, escapeAttrValue } from 'xss';
import {
  escapeHtml as safeEscapeHtml,
  sanitizeHttpOrRelativeUrl,
} from '../../common/utils/html-sanitize';

export type FieldType = 'text' | 'textarea' | 'number' | 'checkbox' | 'list' | 'group';

export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  fields?: FieldDefinition[]; // For 'group' and 'list'
  defaultValue?: unknown;
}

export interface SectionConfig {
  type: PageSectionType;
  label: string;
  fields: FieldDefinition[];
  defaults: Record<string, unknown>;
}

export type SectionRenderer = (data: Record<string, unknown>) => string;

// Helper for escaping HTML
export const escapeHtml = (value: string) => safeEscapeHtml(value);

const sanitizeActionUrl = (url: unknown): string | null =>
  sanitizeHttpOrRelativeUrl(url, {
    allowMailto: true,
    allowTel: true,
    allowHash: true,
  });

const sanitizeCssBackgroundUrl = (url: unknown): string => {
  const safe = sanitizeHttpOrRelativeUrl(url);
  if (!safe || /['"()\\\s]/.test(safe)) {
    return '';
  }
  return escapeHtml(safe);
};

const renderButton = (label?: string, url?: string) => {
  if (!label || !url) return '';
  const safeUrl = sanitizeActionUrl(url);
  if (!safeUrl) return '';
  return `<a class="btn" href="${escapeHtml(safeUrl)}">${escapeHtml(label)}</a>`;
};

const renderHero = (data: Record<string, unknown>) => {
  const headline = data?.headline ? escapeHtml(String(data.headline)) : 'Untitled hero';
  const subheadline = data?.subheadline ? escapeHtml(String(data.subheadline)) : '';
  const backgroundImageUrl = sanitizeCssBackgroundUrl(data?.backgroundImageUrl);
  const primaryCta = data?.primaryCta as Record<string, string> | undefined;
  const secondaryCta = data?.secondaryCta as Record<string, string> | undefined;

  return `
    <section class="section hero" style="${backgroundImageUrl ? `background-image: url('${backgroundImageUrl}');` : ''}">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <h2>${headline}</h2>
        <p>${subheadline}</p>
        <div class="hero-actions">
          ${renderButton(primaryCta?.label, primaryCta?.url)}
          ${renderButton(secondaryCta?.label, secondaryCta?.url)}
        </div>
      </div>
    </section>
  `;
};

const renderHighlights = (data: Record<string, unknown>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : 'Highlights';
  const items = Array.isArray(data?.items) ? data.items : [];
  return `
    <section class="section">
      <h2>${title}</h2>
      <div class="grid three">
        ${items
    .map(
      (item: unknown) => {
        const i = item as Record<string, unknown>;
        return `
            <div class="card-block">
              <h3>${escapeHtml(String(i?.title ?? ''))}</h3>
              <p>${escapeHtml(String(i?.text ?? ''))}</p>
            </div>
          `;
      },
    )
    .join('')}
      </div>
    </section>
  `;
};

const renderStationsGrid = (data: Record<string, unknown>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : 'Stations';
  const maxItems = Number(data?.maxItems ?? 6);
  const placeholders = Array.from({ length: Math.min(maxItems, 6) }, (_, index) => ({
    name: `GameStation ${index + 1}`,
    price: data?.showPrices ? `${(index + 1) * 10} $` : '',
  }));
  return `
    <section class="section">
      <h2>${title}</h2>
      <div class="grid three">
        ${placeholders
    .map(
      (item) => `
            <div class="card-block">
              <h3>${escapeHtml(item.name)}</h3>
              <p>${item.price ? escapeHtml(item.price) : 'Popular choice'}</p>
            </div>
          `,
    )
    .join('')}
      </div>
    </section>
  `;
};

const renderGalleryGrid = (data: Record<string, unknown>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : 'Gallery';
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  return `
    <section class="section">
      <h2>${title}</h2>
      <div class="pill-row">
        ${categories
    .map((c: unknown) => {
      const val = typeof c === 'string' ? c : (c as Record<string, string>)?.value ?? '';
      return `<span class="pill">${escapeHtml(String(val))}</span>`;
    })
    .join('')}
      </div>
      <div class="grid three">
        ${Array.from({ length: 6 })
    .map(
      (_item, index) => `
            <div class="image-card">Image ${index + 1}</div>
          `,
    )
    .join('')}
      </div>
    </section>
  `;
};

const renderTestimonials = (data: Record<string, unknown>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : 'Testimonials';
  const limit = Number(data?.limit ?? 3);
  return `
    <section class="section">
      <h2>${title}</h2>
      <div class="grid three">
        ${Array.from({ length: Math.min(limit, 3) })
    .map(
      (_item, index) => `
            <div class="card-block">
              <p>“Great experience ${index + 1}."</p>
              <span>Happy client</span>
            </div>
          `,
    )
    .join('')}
      </div>
    </section>
  `;
};

const renderFaq = (data: Record<string, unknown>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : 'FAQs';
  const items = Array.isArray(data?.items) ? data.items : [];
  return `
    <section class="section">
      <h2>${title}</h2>
      <div class="stack">
        ${items
    .map(
      (item: unknown) => {
        const i = item as Record<string, unknown>;
        return `
            <div class="card-block">
              <h3>${escapeHtml(String(i?.q ?? ''))}</h3>
              <p>${escapeHtml(String(i?.a ?? ''))}</p>
            </div>
          `;
      },
    )
    .join('')}
      </div>
    </section>
  `;
};

const renderCta = (data: Record<string, unknown>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : 'Ready to book?';
  const text = data?.text ? escapeHtml(String(data.text)) : '';
  return `
    <section class="section cta">
      <h2>${title}</h2>
      <p>${text}</p>
      ${renderButton(data?.buttonLabel as string | undefined, data?.buttonUrl as string | undefined)}
    </section>
  `;
};

const renderContactCard = (data: Record<string, unknown>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : 'Contact';
  const city = data?.city ? escapeHtml(String(data.city)) : '';
  const workHours = data?.workHours ? escapeHtml(String(data.workHours)) : '';
  return `
    <section class="section">
      <h2>${title}</h2>
      <div class="card-block">
        <p>${city}</p>
        <p>${workHours}</p>
      </div>
    </section>
  `;
};

const renderMap = (data: Record<string, unknown>) => {
  const lat = data?.lat ?? 0;
  const lng = data?.lng ?? 0;
  const zoom = data?.zoom ?? 12;
  return `
    <section class="section">
      <h2>Map</h2>
      <div class="map-card">
        <p>Latitude: ${escapeHtml(String(lat))}</p>
        <p>Longitude: ${escapeHtml(String(lng))}</p>
        <p>Zoom: ${escapeHtml(String(zoom))}</p>
      </div>
    </section>
  `;
};

const renderRichText = (data: Record<string, unknown>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : '';
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  return `
    <section class="section">
      ${title ? `<h2>${title}</h2>` : ''}
      <div class="stack">
        ${blocks
    .map((block: unknown) => {
      const b = block as Record<string, unknown>;
      const rawText = typeof b?.text === 'string' ? b.text : String(b?.text ?? '');
      const text = sanitizeRichTextHtml(rawText, Boolean(b?.allowHtml));
      return `<p>${text}</p>`;
    })
    .join('')}
      </div>
    </section>
  `;
};

const renderStaffGrid = (data: Record<string, unknown>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : 'Staff';
  return `
    <section class="section">
      <h2>${title}</h2>
      <div class="grid three">
        ${Array.from({ length: 3 })
    .map(
      (_item, index) => `
            <div class="card-block">
              <h3>Team member ${index + 1}</h3>
              <p>Host</p>
            </div>
          `,
    )
    .join('')}
      </div>
    </section>
  `;
};

const richTextPlainFilter = new FilterXSS({
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  allowCommentTag: false,
  css: false,
});

const richTextXssFilter = new FilterXSS({
  whiteList: {
    a: ['href', 'title', 'target'],
    b: [],
    strong: [],
    i: [],
    em: [],
    u: [],
    s: [],
    br: [],
    span: [],
    code: [],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  allowCommentTag: false,
  css: false,
  onTagAttr: (tag, name, value) => {
    if (tag !== 'a') {
      return '';
    }
    const lowerName = name.toLowerCase();
    if (lowerName === 'href') {
      const safeHref = sanitizeActionUrl(value);
      return safeHref ? `href="${escapeAttrValue(safeHref)}"` : '';
    }
    if (lowerName === 'title') {
      return `title="${escapeAttrValue(value)}"`;
    }
    if (lowerName === 'target') {
      const target = value.trim().toLowerCase();
      if (['_blank', '_self', '_parent', '_top'].includes(target)) {
        return target === '_blank'
          ? 'target="_blank" rel="noopener noreferrer"'
          : `target="${target}"`;
      }
      return '';
    }
    return '';
  },
});

const sanitizeRichTextHtml = (value: string, allowHtml: boolean) => {
  if (!value) return '';
  return allowHtml ? richTextXssFilter.process(value) : richTextPlainFilter.process(value);
};

// --- Configs & Schemas ---

export const SECTION_DEFINITIONS: Record<
  PageSectionType,
  SectionConfig & { schema: z.ZodTypeAny; renderer: SectionRenderer }
> = {
  [PageSectionType.HERO]: {
    type: PageSectionType.HERO,
    label: 'Hero',
    defaults: {
      headline: 'صفحه جدید',
      subheadline: 'رزرو آنلاین و حضوری در شهر شما',
      primaryCta: { label: 'رزرو نوبت', url: '/reservation' },
      secondaryCta: { label: 'مشاهده خدمات', url: '/stations' },
      backgroundImageUrl: 'https://picsum.photos/seed/new-hero/1600/900',
    },
    fields: [
      { name: 'headline', label: 'Headline', type: 'text', required: true },
      { name: 'subheadline', label: 'Subheadline', type: 'text', required: true },
      {
        name: 'primaryCta',
        label: 'Primary CTA',
        type: 'group',
        fields: [
          { name: 'label', label: 'Label', type: 'text', required: true },
          { name: 'url', label: 'URL', type: 'text', required: true },
        ],
      },
      {
        name: 'secondaryCta',
        label: 'Secondary CTA',
        type: 'group',
        fields: [
          { name: 'label', label: 'Label', type: 'text', required: true },
          { name: 'url', label: 'URL', type: 'text', required: true },
        ],
      },
      { name: 'backgroundImageUrl', label: 'Background Image URL', type: 'text', required: true },
    ],
    schema: z.object({
      headline: z.string().min(1),
      subheadline: z.string().min(1),
      primaryCta: z.object({
        label: z.string().min(1),
        url: z
          .string()
          .min(1)
          .refine((value) => Boolean(sanitizeActionUrl(value)), {
            message: 'URL must use http, https, mailto, tel, relative /, or #.',
          }),
      }),
      secondaryCta: z.object({
        label: z.string().min(1),
        url: z
          .string()
          .min(1)
          .refine((value) => Boolean(sanitizeActionUrl(value)), {
            message: 'URL must use http, https, mailto, tel, relative /, or #.',
          }),
      }),
      backgroundImageUrl: z
        .string()
        .min(1)
        .refine((value) => Boolean(sanitizeCssBackgroundUrl(value)), {
          message: 'Background image URL must be a valid http/https/relative image URL.',
        }),
    }),
    renderer: renderHero,
  },
  [PageSectionType.HIGHLIGHTS]: {
    type: PageSectionType.HIGHLIGHTS,
    label: 'Highlights',
    defaults: {
      title: 'چرا ما؟',
      items: [
        { title: 'محیط بهداشتی', text: 'ضدعفونی منظم ابزار و رعایت کامل پروتکل‌ها' },
        { title: 'پرسنل حرفه‌ای', text: 'متخصصین با تجربه در مو، پوست و ناخن' },
        { title: 'رزرو آسان', text: 'رزرو آنلاین/حضوری با مدیریت زمان' },
      ],
    },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      {
        name: 'items',
        label: 'Items',
        type: 'list',
        fields: [
          { name: 'title', label: 'Item Title', type: 'text', required: true },
          { name: 'text', label: 'Item Text', type: 'textarea', required: true },
        ],
      },
    ],
    schema: z.object({
      title: z.string().min(1),
      items: z.array(
        z.object({
          title: z.string().min(1),
          text: z.string().min(1),
        }),
      ),
    }),
    renderer: renderHighlights,
  },
  [PageSectionType.SERVICES_GRID]: {
    type: PageSectionType.SERVICES_GRID,
    label: 'Stations Grid',
    defaults: {
      title: 'خدمات پرطرفدار',
      showPrices: true,
      maxItems: 12,
    },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'showPrices', label: 'Show Prices', type: 'checkbox' },
      { name: 'maxItems', label: 'Max Items', type: 'number', required: true },
    ],
    schema: z.object({
      title: z.string().min(1),
      showPrices: z.boolean(),
      maxItems: z.number().int().positive(),
    }),
    renderer: renderStationsGrid,
  },
  [PageSectionType.GALLERY_GRID]: {
    type: PageSectionType.GALLERY_GRID,
    label: 'Gallery Grid',
    defaults: {
      title: 'گالری نمونه کار',
      categories: ['مو', 'ناخن', 'پوست', 'سالن'],
      limit: 12,
    },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'limit', label: 'Limit', type: 'number', required: true },
      {
        name: 'categories',
        label: 'Categories',
        type: 'list',
        fields: [
          { name: 'value', label: 'Category Name', type: 'text', required: true },
        ],
      },
    ],
    schema: z.object({
      title: z.string().min(1),
      categories: z.array(z.union([
        z.string().min(1),
        z.object({ value: z.string().min(1) })
      ])),
      limit: z.number().int().positive(),
    }),
    renderer: renderGalleryGrid,
  },
  [PageSectionType.TESTIMONIALS]: {
    type: PageSectionType.TESTIMONIALS,
    label: 'Testimonials',
    defaults: {
      title: 'نظرات مشتریان',
      limit: 6,
    },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'limit', label: 'Limit', type: 'number', required: true },
    ],
    schema: z.object({
      title: z.string().min(1),
      limit: z.number().int().positive(),
    }),
    renderer: renderTestimonials,
  },
  [PageSectionType.FAQ]: {
    type: PageSectionType.FAQ,
    label: 'FAQ',
    defaults: {
      title: 'سوالات پرتکرار',
      items: [
        { q: 'برای رزرو آنلاین نیاز به پرداخت است؟', a: 'بسته به سرویس، ممکن است بیعانه فعال باشد.' },
        { q: 'چطور زمان رزرو را تغییر دهم؟', a: 'از طریق تماس با پذیرش یا پنل رزرو اقدام کنید.' },
      ],
    },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      {
        name: 'items',
        label: 'Questions',
        type: 'list',
        fields: [
          { name: 'q', label: 'Question', type: 'text', required: true },
          { name: 'a', label: 'Answer', type: 'textarea', required: true },
        ],
      },
    ],
    schema: z.object({
      title: z.string().min(1),
      items: z.array(
        z.object({
          q: z.string().min(1),
          a: z.string().min(1),
        }),
      ),
    }),
    renderer: renderFaq,
  },
  [PageSectionType.CTA]: {
    type: PageSectionType.CTA,
    label: 'Call to Action',
    defaults: {
      title: 'برای تغییر استایل آماده‌اید؟',
      text: 'همین الان نوبت خود را رزرو کنید.',
      buttonLabel: 'رزرو نوبت',
      buttonUrl: '/reservation',
    },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'text', label: 'Text', type: 'textarea', required: true },
      { name: 'buttonLabel', label: 'Button Label', type: 'text', required: true },
      { name: 'buttonUrl', label: 'Button URL', type: 'text', required: true },
    ],
    schema: z.object({
      title: z.string().min(1),
      text: z.string().min(1),
      buttonLabel: z.string().min(1),
      buttonUrl: z
        .string()
        .min(1)
        .refine((value) => Boolean(sanitizeActionUrl(value)), {
          message: 'Button URL must use http, https, mailto, tel, relative /, or #.',
        }),
    }),
    renderer: renderCta,
  },
  [PageSectionType.CONTACT_CARD]: {
    type: PageSectionType.CONTACT_CARD,
    label: 'Contact Card',
    defaults: {
      title: 'اطلاعات تماس',
      city: 'تهران',
      workHours: '09:00 تا 20:00',
    },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'city', label: 'City', type: 'text', required: true },
      { name: 'workHours', label: 'Work Hours', type: 'text', required: true },
    ],
    schema: z.object({
      title: z.string().min(1),
      city: z.string().min(1),
      workHours: z.string().min(1),
    }),
    renderer: renderContactCard,
  },
  [PageSectionType.MAP]: {
    type: PageSectionType.MAP,
    label: 'Map',
    defaults: {
      lat: 35.6892,
      lng: 51.389,
      zoom: 14,
    },
    fields: [
      { name: 'lat', label: 'Latitude', type: 'number', required: true },
      { name: 'lng', label: 'Longitude', type: 'number', required: true },
      { name: 'zoom', label: 'Zoom', type: 'number', required: true },
    ],
    schema: z.object({
      lat: z.number(),
      lng: z.number(),
      zoom: z.number().int().positive(),
    }),
    renderer: renderMap,
  },
  [PageSectionType.RICH_TEXT]: {
    type: PageSectionType.RICH_TEXT,
    label: 'Rich Text',
    defaults: {
      title: 'درباره ما',
      blocks: [
        { type: 'paragraph', text: 'ما با تمرکز بر کیفیت، بهداشت و تجربه مشتری فعالیت می‌کنیم.' },
        { type: 'paragraph', text: 'تیم ما با جدیدترین متدها آماده ارائه خدمات است.' },
      ],
    },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      {
        name: 'blocks',
        label: 'Content Blocks',
        type: 'list',
        fields: [
          { name: 'type', label: 'Block Type', type: 'text', required: true },
          { name: 'text', label: 'Text Content', type: 'textarea', required: true },
          { name: 'allowHtml', label: 'Allow HTML', type: 'checkbox' },
        ],
      },
    ],
    schema: z.object({
      title: z.string().min(1),
      blocks: z.array(z
        .object({
          type: z.string().min(1),
          text: z.string().min(1),
          allowHtml: z.boolean().optional(),
        })
        .transform((value) => ({
          ...value,
          text: sanitizeRichTextHtml(value.text, Boolean(value.allowHtml)),
        }))),
    }),
    renderer: renderRichText,
  },
  [PageSectionType.STAFF_GRID]: {
    type: PageSectionType.STAFF_GRID,
    label: 'Staff Grid',
    defaults: {
      title: 'تیم ما',
      showRoles: true,
      showBio: true,
    },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'showRoles', label: 'Show Roles', type: 'checkbox' },
      { name: 'showBio', label: 'Show Bio', type: 'checkbox' },
    ],
    schema: z.object({
      title: z.string().min(1),
      showRoles: z.boolean(),
      showBio: z.boolean(),
    }),
    renderer: renderStaffGrid,
  },
};
