import { RobotsFollow, RobotsIndex } from '@prisma/client';
import { buildSeoMeta, renderPageDocument } from './page-renderer';

type PageInput = Parameters<typeof buildSeoMeta>[0]['page'];
type SiteSettingsInput = NonNullable<Parameters<typeof buildSeoMeta>[0]['siteSettings']>;

const basePage: PageInput = {
  title: 'About Us',
  seoTitle: null,
  seoDescription: null,
  canonicalPath: null,
  ogTitle: null,
  ogDescription: null,
  ogImageUrl: null,
  robotsIndex: RobotsIndex.INDEX,
  robotsFollow: RobotsFollow.FOLLOW,
  structuredDataJson: null,
};

describe('buildSeoMeta', () => {
  it('prefers page overrides over site defaults', () => {
    const siteSettings: SiteSettingsInput = {
      defaultSeoTitle: 'Default Title',
      defaultSeoDescription: 'Default description',
      defaultOgImageUrl: 'https://example.com/default-og.png',
      robotsIndex: RobotsIndex.NOINDEX,
      robotsFollow: RobotsFollow.NOFOLLOW,
    };
    const page: PageInput = {
      ...basePage,
      seoTitle: 'Page SEO Title',
      seoDescription: 'Page SEO description',
      ogImageUrl: 'https://example.com/page-og.png',
      robotsIndex: RobotsIndex.INDEX,
      robotsFollow: RobotsFollow.FOLLOW,
    };

    const meta = buildSeoMeta({ page, siteSettings });

    expect(meta.title).toBe('Page SEO Title');
    expect(meta.description).toBe('Page SEO description');
    expect(meta.ogImageUrl).toBe('https://example.com/page-og.png');
    expect(meta.robots).toBe('index, follow');
  });

  it('falls back to site defaults when page values are missing', () => {
    const siteSettings: SiteSettingsInput = {
      defaultSeoTitle: 'Default Title',
      defaultSeoDescription: 'Default description',
      defaultOgImageUrl: 'https://example.com/default-og.png',
      robotsIndex: RobotsIndex.NOINDEX,
      robotsFollow: RobotsFollow.NOFOLLOW,
    };
    const page: PageInput = {
      ...basePage,
      seoTitle: null,
      seoDescription: null,
      ogImageUrl: null,
      robotsIndex: null as never,
      robotsFollow: null as never,
    };

    const meta = buildSeoMeta({ page, siteSettings });

    expect(meta.title).toBe('Default Title');
    expect(meta.description).toBe('Default description');
    expect(meta.ogImageUrl).toBe('https://example.com/default-og.png');
    expect(meta.robots).toBe('noindex, nofollow');
  });

  it('maps robots enums into a meta tag value', () => {
    const page: PageInput = {
      ...basePage,
      robotsIndex: RobotsIndex.NOINDEX,
      robotsFollow: RobotsFollow.FOLLOW,
    };

    const meta = buildSeoMeta({ page });

    expect(meta.robots).toBe('noindex, follow');
  });

  it('uses NOINDEX/NOFOLLOW when specified', () => {
    const page: PageInput = {
      ...basePage,
      robotsIndex: RobotsIndex.NOINDEX,
      robotsFollow: RobotsFollow.NOFOLLOW,
    };

    const meta = buildSeoMeta({ page });

    expect(meta.robots).toBe('noindex, nofollow');
  });
});

describe('renderPageDocument', () => {
  it('renders open graph meta tags for public pages', () => {
    const html = renderPageDocument({
      page: {
        ...basePage,
        ogTitle: 'OG Title',
        ogDescription: 'OG Description',
        ogImageUrl: 'https://example.com/og.png',
      },
    });

    expect(html).toContain('<meta property="og:title" content="OG Title" />');
    expect(html).toContain('<meta property="og:description" content="OG Description" />');
    expect(html).toContain('<meta property="og:image" content="https://example.com/og.png" />');
  });

  it('renders robots meta tag for NOINDEX/NOFOLLOW', () => {
    const html = renderPageDocument({
      page: {
        ...basePage,
        robotsIndex: RobotsIndex.NOINDEX,
        robotsFollow: RobotsFollow.NOFOLLOW,
      },
    });

    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
  });

  it('renders sanitized JSON-LD when structured data is valid', () => {
    const html = renderPageDocument({
      page: {
        ...basePage,
        structuredDataJson: JSON.stringify({
          '@context': 'https://schema.org',
          name: '</script><script>alert(1)</script>',
        }),
      },
    });

    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain(
      '"name":"\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e"'
    );
    expect(html).not.toContain('</script><script>alert(1)</script>');
  });

  it('skips JSON-LD rendering when structured data is invalid', () => {
    const html = renderPageDocument({
      page: {
        ...basePage,
        structuredDataJson: '{"@context": "https://schema.org",}',
      },
    });

    expect(html).not.toContain('application/ld+json');
  });
});
