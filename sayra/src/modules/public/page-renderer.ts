import { RobotsFollow, RobotsIndex } from '@prisma/client';
import type { Page, SiteSettings } from '@prisma/client';
import { renderPageSections } from '../../components/cms/PageRenderer';
import { PageSectionInput, escapeHtml } from '../../components/cms/sections/sectionRenderers';

type PageRenderInput = {
  title?: string;
  page?: SeoPageInput;
  siteSettings?: SeoSiteSettingsInput | null;
  sections?: PageSectionInput[];
  pageId?: string;
};

type SeoPageInput = Pick<
  Page,
  | 'title'
  | 'seoTitle'
  | 'seoDescription'
  | 'canonicalPath'
  | 'ogTitle'
  | 'ogDescription'
  | 'ogImageUrl'
  | 'robotsIndex'
  | 'robotsFollow'
  | 'structuredDataJson'
>;

type SeoSiteSettingsInput = Pick<
  SiteSettings,
  | 'defaultSeoTitle'
  | 'defaultSeoDescription'
  | 'defaultOgImageUrl'
  | 'robotsIndex'
  | 'robotsFollow'
>;

type SeoMeta = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  robots?: string;
  structuredDataJson?: string | null;
};

const sanitizeStructuredDataJson = (structuredDataJson?: string | null) => {
  if (!structuredDataJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(structuredDataJson);
    if (parsed === null || typeof parsed !== 'object') {
      return null;
    }
    return JSON.stringify(parsed)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');
  } catch {
    return null;
  }
};

const buildRobotsMeta = ({
  robotsIndex,
  robotsFollow,
}: {
  robotsIndex?: RobotsIndex | null;
  robotsFollow?: RobotsFollow | null;
}) => {
  const tokens: string[] = [];
  if (robotsIndex) {
    tokens.push(robotsIndex === RobotsIndex.INDEX ? 'index' : 'noindex');
  }
  if (robotsFollow) {
    tokens.push(robotsFollow === RobotsFollow.FOLLOW ? 'follow' : 'nofollow');
  }
  return tokens.length ? tokens.join(', ') : undefined;
};

export const buildSeoMeta = ({
  page,
  siteSettings,
}: {
  page: SeoPageInput;
  siteSettings?: SeoSiteSettingsInput | null;
}): SeoMeta => {
  const baseTitle = page.seoTitle ?? siteSettings?.defaultSeoTitle ?? page.title ?? 'Preview';
  const description = page.seoDescription ?? siteSettings?.defaultSeoDescription ?? undefined;
  const ogTitle =
    page.ogTitle ?? page.seoTitle ?? siteSettings?.defaultSeoTitle ?? page.title ?? 'Preview';
  const ogDescription =
    page.ogDescription ?? page.seoDescription ?? siteSettings?.defaultSeoDescription ?? undefined;
  const ogImageUrl = page.ogImageUrl ?? siteSettings?.defaultOgImageUrl ?? undefined;
  const robots = buildRobotsMeta({
    robotsIndex: page.robotsIndex ?? siteSettings?.robotsIndex,
    robotsFollow: page.robotsFollow ?? siteSettings?.robotsFollow,
  });

  return {
    title: baseTitle,
    description,
    canonicalPath: page.canonicalPath ?? undefined,
    ogTitle,
    ogDescription,
    ogImageUrl,
    robots,
    structuredDataJson: page.structuredDataJson,
  };
};

const renderSeoMeta = (meta: SeoMeta) => {
  const tags = [];

  if (meta.title) {
    tags.push(`<title>${escapeHtml(meta.title)}</title>`);
  }
  if (meta.description) {
    tags.push(`<meta name="description" content="${escapeHtml(meta.description)}" />`);
  }
  if (meta.robots) {
    tags.push(`<meta name="robots" content="${escapeHtml(meta.robots)}" />`);
  }
  if (meta.canonicalPath) {
    tags.push(`<link rel="canonical" href="${escapeHtml(meta.canonicalPath)}" />`);
  }
  if (meta.ogTitle) {
    tags.push(`<meta property="og:title" content="${escapeHtml(meta.ogTitle)}" />`);
  }
  if (meta.ogDescription) {
    tags.push(`<meta property="og:description" content="${escapeHtml(meta.ogDescription)}" />`);
  }
  if (meta.ogImageUrl) {
    tags.push(`<meta property="og:image" content="${escapeHtml(meta.ogImageUrl)}" />`);
  }
  const sanitizedStructuredData = sanitizeStructuredDataJson(meta.structuredDataJson);
  if (sanitizedStructuredData) {
    tags.push(`<script type="application/ld+json">${sanitizedStructuredData}</script>`);
  }

  return tags.join('\n    ');
};

export const renderPageDocument = ({
  title,
  page,
  siteSettings,
  sections,
  pageId,
}: PageRenderInput) => {
  const resolvedPage = page ?? ({
    title: title ?? 'Preview',
    seoTitle: null,
    seoDescription: null,
    canonicalPath: null,
    ogTitle: null,
    ogDescription: null,
    ogImageUrl: null,
    robotsIndex: RobotsIndex.INDEX,
    robotsFollow: RobotsFollow.FOLLOW,
    structuredDataJson: null,
  } as SeoPageInput);
  const seoMeta = buildSeoMeta({ page: resolvedPage, siteSettings });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${renderSeoMeta(seoMeta)}
    <style>
      body {
        margin: 0;
        font-family: "Inter", "Segoe UI", sans-serif;
        color: #111827;
        background: #f9fafb;
      }
      .page {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px 24px 64px;
      }
      .section {
        margin-bottom: 32px;
      }
      h2 {
        margin: 0 0 12px;
        font-size: 24px;
      }
      h3 {
        margin: 0 0 6px;
        font-size: 16px;
      }
      p {
        margin: 0 0 8px;
        color: #4b5563;
        line-height: 1.6;
      }
      .hero {
        position: relative;
        color: #ffffff;
        border-radius: 20px;
        padding: 64px 32px;
        background: #1f2937;
        background-size: cover;
        background-position: center;
        overflow: hidden;
      }
      .hero-overlay {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.55);
      }
      .hero-content {
        position: relative;
        z-index: 1;
        max-width: 600px;
      }
      .hero-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 18px;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 18px;
        border-radius: 999px;
        background: #ffffff;
        color: #111827;
        font-size: 14px;
        text-decoration: none;
        font-weight: 600;
      }
      .grid {
        display: grid;
        gap: 16px;
      }
      .grid.three {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }
      .card-block {
        background: #ffffff;
        border-radius: 16px;
        padding: 16px;
        border: 1px solid #e5e7eb;
      }
      .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
      }
      .pill {
        padding: 6px 12px;
        border-radius: 999px;
        background: #eef2ff;
        color: #4338ca;
        font-size: 12px;
      }
      .image-card {
        height: 120px;
        background: #e5e7eb;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6b7280;
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .cta {
        background: #111827;
        color: #ffffff;
        padding: 32px;
        border-radius: 20px;
      }
      .cta p {
        color: #d1d5db;
      }
      .cta .btn {
        background: #ffffff;
        color: #111827;
      }
      .map-card {
        border: 1px dashed #cbd5f5;
        padding: 16px;
        border-radius: 12px;
        background: #eef2ff;
      }
      /* Advertisement Slider Styles */
      .ad-slider-container {
        position: relative;
        overflow: hidden;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        background: #0f172a;
        margin-bottom: 32px;
        width: 100%;
        aspect-ratio: 16 / 6;
        min-height: 220px;
      }
      @media (max-width: 768px) {
        .ad-slider-container {
          aspect-ratio: 16 / 9;
        }
      }
      .ad-slides-wrapper {
        display: flex;
        height: 100%;
        transition: transform 0.5s ease-in-out;
      }
      .ad-slide {
        min-width: 100%;
        height: 100%;
        position: relative;
        display: flex;
        align-items: flex-end;
      }
      .ad-slide img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .ad-slide-caption {
        position: relative;
        z-index: 2;
        width: 100%;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0) 100%);
        padding: 32px 24px 20px;
        color: #ffffff;
      }
      .ad-slide-title {
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 6px;
      }
      .ad-slide-desc {
        font-size: 14px;
        color: #e2e8f0;
        margin-bottom: 0;
      }
      .ad-slider-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(15, 23, 42, 0.6);
        color: #ffffff;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        z-index: 10;
        transition: background 0.2s;
      }
      .ad-slider-btn:hover {
        background: rgba(15, 23, 42, 0.9);
      }
      .ad-slider-btn.prev { left: 16px; }
      .ad-slider-btn.next { right: 16px; }
      .ad-slider-dots {
        position: absolute;
        bottom: 12px;
        right: 24px;
        display: flex;
        gap: 8px;
        z-index: 10;
      }
      .ad-slider-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.4);
        cursor: pointer;
        transition: background 0.2s, transform 0.2s;
      }
      .ad-slider-dot.active {
        background: #ffffff;
        transform: scale(1.2);
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div id="playnest-ad-slider" class="ad-slider-container" style="display:none;">
        <div class="ad-slides-wrapper" id="ad-slides-wrapper"></div>
        <button class="ad-slider-btn prev" onclick="prevAdSlide()" aria-label="Previous slide">&#10094;</button>
        <button class="ad-slider-btn next" onclick="nextAdSlide()" aria-label="Next slide">&#10095;</button>
        <div class="ad-slider-dots" id="ad-slider-dots"></div>
      </div>
      <script>
        (function() {
          var sliderElem = document.getElementById('playnest-ad-slider');
          var wrapper = document.getElementById('ad-slides-wrapper');
          var dotsElem = document.getElementById('ad-slider-dots');
          var currentIndex = 0;
          var slidesCount = 0;
          var autoPlayInterval = null;

          function renderSlider(ads) {
            if (!ads || !ads.length) return;
            slidesCount = ads.length;
            wrapper.innerHTML = ads.map(function(ad, idx) {
              var linkAttr = ad.destinationUrl ? 'onclick="window.open(\'' + ad.destinationUrl.replace(/"/g, '&quot;') + '\', \'_blank\')" style="cursor:pointer;"' : '';
              return '<div class="ad-slide" ' + linkAttr + '>' +
                '<img src="' + ad.bannerUrl + '" alt="' + (ad.title || '') + '" onerror="this.src=\'https://picsum.photos/seed/adfallback/1200/450\'" />' +
                '<div class="ad-slide-caption">' +
                  '<div class="ad-slide-title">' + (ad.title || '') + '</div>' +
                  (ad.description ? '<p class="ad-slide-desc">' + ad.description + '</p>' : '') +
                '</div>' +
              '</div>';
            }).join('');

            dotsElem.innerHTML = ads.map(function(_, idx) {
              return '<div class="ad-slider-dot' + (idx === 0 ? ' active' : '') + '" onclick="goToAdSlide(' + idx + ')"></div>';
            }).join('');

            sliderElem.style.display = 'block';
            startAutoPlay();
          }

          window.goToAdSlide = function(index) {
            if (slidesCount <= 0) return;
            currentIndex = (index + slidesCount) % slidesCount;
            wrapper.style.transform = 'translateX(-' + (currentIndex * 100) + '%)';
            var dots = dotsElem.querySelectorAll('.ad-slider-dot');
            dots.forEach(function(d, i) {
              if (i === currentIndex) d.classList.add('active');
              else d.classList.remove('active');
            });
          };

          window.nextAdSlide = function() {
            goToAdSlide(currentIndex + 1);
            resetAutoPlay();
          };

          window.prevAdSlide = function() {
            goToAdSlide(currentIndex - 1);
            resetAutoPlay();
          };

          function startAutoPlay() {
            if (slidesCount > 1) {
              autoPlayInterval = setInterval(function() {
                goToAdSlide(currentIndex + 1);
              }, 5000);
            }
          }

          function resetAutoPlay() {
            if (autoPlayInterval) clearInterval(autoPlayInterval);
            startAutoPlay();
          }

          // Fetch active slider ads
          fetch('/api/v1/public/advertisements/slider')
            .then(function(res) { return res.json(); })
            .then(function(resData) {
              var ads = resData.data || [];
              renderSlider(ads);
            })
            .catch(function(e) { console.warn('Could not load slider ads:', e); });
        })();
      </script>
      ${renderPageSections(sections ?? [], pageId)}
    </div>
  </body>
</html>`;
};
