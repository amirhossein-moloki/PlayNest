import { PageSectionType } from '@prisma/client';

import { PageSectionInput, escapeHtml, sectionRenderers } from './sections/sectionRenderers';
import { parseSectionDataJson } from '../../modules/cms/section-data';

type PageRendererProps = {
  sections?: PageSectionInput[];
  pageId?: string;
};

const renderFallbackSection = (sectionType: PageSectionType | string) => `
  <section class="section">
    <div class="card-block">
      <h3>Section unavailable</h3>
      <p>We couldn't load the ${escapeHtml(String(sectionType))} section.</p>
    </div>
  </section>
`;

export const renderPageSections = (sections: PageSectionInput[] = [], pageId?: string) =>
  [...sections]
    .filter((section) => section?.isEnabled !== false)
    .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0))
    .map((section) => {
      const renderer = sectionRenderers[section.type as PageSectionType];
      if (!renderer) {
        return renderFallbackSection(section.type);
      }
      const data = parseSectionDataJson({
        type: section.type,
        dataJson: section.dataJson,
        pageId,
        sectionId: section.id ?? undefined,
      });
      if (!data) {
        return renderFallbackSection(section.type);
      }
      return renderer(data);
    })
    .join('');

export const PageRenderer = ({ sections = [], pageId }: PageRendererProps) =>
  renderPageSections(sections, pageId);
