/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderPageDocument } from '../../../../src/modules/public/page-renderer';
import { describe, it, expect } from '@jest/globals';

describe('Page Renderer', () => {
  it('should render a simple page with title', () => {
    const page = {
      title: 'Test Page',
      sections: [],
    };
    const html = renderPageDocument(page as any);
    expect(html).toContain('<title>Test Page</title>');
  });

  it('should render sections based on definitions', () => {
    const page = {
      title: 'Test Page',
      sections: [
        {
          type: 'HERO',
          dataJson: JSON.stringify({
            headline: 'Hero Headline',
            subheadline: 'Hero Subheadline',
            primaryCta: { label: 'Book', url: '/book' },
            secondaryCta: { label: 'View', url: '/view' },
            backgroundImageUrl: 'http://example.com/img.jpg'
          })
        }
      ],
    };
    const html = renderPageDocument(page as any);
    expect(html).toContain('Hero Headline');
    expect(html).toContain('Hero Subheadline');
    expect(html).toContain('Book');
  });

  it('should render Highlights section', () => {
    const page = {
      title: 'Highlights Test',
      sections: [
        {
          type: 'HIGHLIGHTS',
          dataJson: JSON.stringify({
            title: 'Our Highlights',
            items: [
              { title: 'Feature 1', text: 'Text 1' },
              { title: 'Feature 2', text: 'Text 2' }
            ]
          })
        }
      ],
    };
    const html = renderPageDocument(page as any);
    expect(html).toContain('Our Highlights');
    expect(html).toContain('Feature 1');
    expect(html).toContain('Text 1');
  });
});
