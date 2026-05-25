/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { PageSectionType } from '@prisma/client';
import { sectionConfigs } from './section-config';
import { SECTION_DEFINITIONS, escapeHtml } from './section-definitions';

export { escapeHtml };

export type PageSectionInput = {
  id?: string | null;
  type: PageSectionType | string;
  dataJson?: string | null;
  isEnabled?: boolean | null;
  sortOrder?: number | null;
};

export const pageSectionSchemas = Object.fromEntries(
  Object.entries(SECTION_DEFINITIONS).map(([type, def]) => [type, def.schema])
) as Record<PageSectionType, z.ZodTypeAny>;

const renderButton = (label?: string, url?: string) => {
  if (!label || !url) return '';
  return `<a class="btn" href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
};

const renderHero = (data: Record<string, any>) => {
  const headline = data?.headline ? escapeHtml(String(data.headline)) : 'Untitled hero';
  const subheadline = data?.subheadline ? escapeHtml(String(data.subheadline)) : '';
  const backgroundImageUrl = data?.backgroundImageUrl
    ? escapeHtml(String(data.backgroundImageUrl))
    : '';
  return `
    <section class="section hero" style="${backgroundImageUrl ? `background-image: url('${backgroundImageUrl}');` : ''}">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <h2>${headline}</h2>
        <p>${subheadline}</p>
        <div class="hero-actions">
          ${renderButton(data?.primaryCta?.label, data?.primaryCta?.url)}
          ${renderButton(data?.secondaryCta?.label, data?.secondaryCta?.url)}
        </div>
      </div>
    </section>
  `;
};

const renderHighlights = (data: Record<string, any>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : 'Highlights';
  const items = Array.isArray(data?.items) ? data.items : [];
  return `
    <section class="section">
      <h2>${title}</h2>
      <div class="grid three">
        ${items
    .map(
      (item: Record<string, any>) => `
            <div class="card-block">
              <h3>${escapeHtml(String(item?.title ?? ''))}</h3>
              <p>${escapeHtml(String(item?.text ?? ''))}</p>
            </div>
          `,
    )
    .join('')}
      </div>
    </section>
  `;
};

const renderServicesGrid = (data: Record<string, any>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : 'Services';
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

const renderGalleryGrid = (data: Record<string, any>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : 'Gallery';
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  return `
    <section class="section">
      <h2>${title}</h2>
      <div class="pill-row">
        ${categories
    .map((c: any) => {
      const val = typeof c === 'string' ? c : c?.value ?? '';
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

const renderTestimonials = (data: Record<string, any>) => {
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

const renderFaq = (data: Record<string, any>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : 'FAQs';
  const items = Array.isArray(data?.items) ? data.items : [];
  return `
    <section class="section">
      <h2>${title}</h2>
      <div class="stack">
        ${items
    .map(
      (item: Record<string, any>) => `
            <div class="card-block">
              <h3>${escapeHtml(String(item?.q ?? ''))}</h3>
              <p>${escapeHtml(String(item?.a ?? ''))}</p>
            </div>
          `,
    )
    .join('')}
      </div>
    </section>
  `;
};

const renderCta = (data: Record<string, any>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : 'Ready to book?';
  const text = data?.text ? escapeHtml(String(data.text)) : '';
  return `
    <section class="section cta">
      <h2>${title}</h2>
      <p>${text}</p>
      ${renderButton(data?.buttonLabel, data?.buttonUrl)}
    </section>
  `;
};

const renderContactCard = (data: Record<string, any>) => {
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

const renderMap = (data: Record<string, any>) => {
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

const renderRichText = (data: Record<string, any>) => {
  const title = data?.title ? escapeHtml(String(data.title)) : '';
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  return `
    <section class="section">
      ${title ? `<h2>${title}</h2>` : ''}
      <div class="stack">
        ${blocks
    .map((block: Record<string, any>) => {
      const text = block?.text ?? '';
      if (block?.allowHtml) {
        return `<p>${text}</p>`;
      }
      return `<p>${escapeHtml(String(text))}</p>`;
    })
    .join('')}
      </div>
    </section>
  `;
};

const renderStaffGrid = (data: Record<string, any>) => {
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
              <p>Stylist</p>
            </div>
          `,
    )
    .join('')}
      </div>
    </section>
  `;
};


type RegistryEntry = {
  schema: z.ZodTypeAny;
  renderer: (data: Record<string, any>) => string;
};

export const pageSectionRegistry: Record<PageSectionType, RegistryEntry> = {
  [PageSectionType.HERO]: {
    schema: SECTION_DEFINITIONS[PageSectionType.HERO].schema,
    renderer: renderHero,
  },
  [PageSectionType.HIGHLIGHTS]: {
    schema: SECTION_DEFINITIONS[PageSectionType.HIGHLIGHTS].schema,
    renderer: renderHighlights,
  },
  [PageSectionType.SERVICES_GRID]: {
    schema: SECTION_DEFINITIONS[PageSectionType.SERVICES_GRID].schema,
    renderer: renderServicesGrid,
  },
  [PageSectionType.GALLERY_GRID]: {
    schema: SECTION_DEFINITIONS[PageSectionType.GALLERY_GRID].schema,
    renderer: renderGalleryGrid,
  },
  [PageSectionType.TESTIMONIALS]: {
    schema: SECTION_DEFINITIONS[PageSectionType.TESTIMONIALS].schema,
    renderer: renderTestimonials,
  },
  [PageSectionType.FAQ]: {
    schema: SECTION_DEFINITIONS[PageSectionType.FAQ].schema,
    renderer: renderFaq,
  },
  [PageSectionType.CTA]: {
    schema: SECTION_DEFINITIONS[PageSectionType.CTA].schema,
    renderer: renderCta,
  },
  [PageSectionType.CONTACT_CARD]: {
    schema: SECTION_DEFINITIONS[PageSectionType.CONTACT_CARD].schema,
    renderer: renderContactCard,
  },
  [PageSectionType.MAP]: {
    schema: SECTION_DEFINITIONS[PageSectionType.MAP].schema,
    renderer: renderMap,
  },
  [PageSectionType.RICH_TEXT]: {
    schema: SECTION_DEFINITIONS[PageSectionType.RICH_TEXT].schema,
    renderer: renderRichText,
  },
  [PageSectionType.STAFF_GRID]: {
    schema: SECTION_DEFINITIONS[PageSectionType.STAFF_GRID].schema,
    renderer: renderStaffGrid,
  },
};

export const sectionRenderers = Object.fromEntries(
  Object.entries(pageSectionRegistry).map(([type, entry]) => [type, entry.renderer]),
) as Record<PageSectionType, (data: Record<string, any>) => string>;

export const pageSectionSchemaByType = (type: PageSectionType) => pageSectionSchemas[type];

export const validateSectionData = (type: PageSectionType, dataJson: string) => {
  const schema = pageSectionSchemaByType(type);
  if (!schema) {
    throw new Error(`Unsupported page section type: ${type}`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(dataJson);
  } catch (error) {
    throw new Error('Section data is not valid JSON.');
  }

  return schema.parse(parsedJson);
};

export const serializeSectionRegistryForEditor = () => {
  return JSON.stringify(sectionConfigs, null, 2);
};
