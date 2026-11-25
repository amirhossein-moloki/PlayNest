/* eslint-disable @typescript-eslint/no-explicit-any */
import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PageSectionType, UserRole } from '@prisma/client';
import { prisma } from '../../src/config/prisma';
import { generateAccessToken } from '../../src/modules/auth/auth.tokens';
import { cmsAdminUiRouter } from '../../src/modules/cms/admin-ui.routes';
import {
  pagesListTemplate,
  pageEditorTemplate,
} from '../../src/modules/cms/admin-ui.templates';
import { SECTION_DEFINITIONS } from '../../src/modules/cms/section-definitions';
import { renderPageDocument } from '../../src/modules/public/page-renderer';

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
  },
}));

function extractScripts(html: string): string[] {
  const scripts: string[] = [];
  const regex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (!match[0].includes('application/ld+json')) {
      scripts.push(match[1]);
    }
  }
  return scripts;
}

describe('SEC-015: CMS Admin UI Reflected XSS & Public CMS Stored XSS', () => {
  const validCenterId = 'cmwlxvn5r0014137pppik07te';
  const validPageId = 'cmwly4svx002b137pwem9snx1';

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockImplementation((() =>
      Promise.resolve({
        id: 'usr-cms-mgr',
        gamingCenterId: validCenterId,
        role: UserRole.MANAGER,
        isActive: true,
      })) as any);
  });

  it('cmsAdminUiRouter rejects invalid/XSS gamingCenterId and pageId with 400 and renders valid CUIDs', async () => {
    const app = express();
    app.use('/api/v1/admin', cmsAdminUiRouter);

    const managerToken = generateAccessToken({
      sessionId: 'sess-cms-1',
      actorId: 'usr-cms-mgr',
      actorType: 'USER',
    });

    const xssPayload = encodeURIComponent("';alert(1);");
    const unauthRes = await request(app).get(`/api/v1/admin/gamingCenters/${xssPayload}/pages`);
    expect(unauthRes.status).toBe(401);

    const badListRes = await request(app)
      .get(`/api/v1/admin/gamingCenters/${xssPayload}/pages`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(badListRes.status).toBe(400);

    const badEditorRes = await request(app)
      .get(`/api/v1/admin/gamingCenters/${validCenterId}/pages/${xssPayload}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(badEditorRes.status).toBe(400);

    const goodEditorRes = await request(app)
      .get(`/api/v1/admin/gamingCenters/${validCenterId}/pages/${validPageId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(goodEditorRes.status).toBe(200);
    expect(goodEditorRes.text).toContain(validCenterId);
    expect(goodEditorRes.text).toContain(validPageId);
  });

  it('CMS UI templates escape breakout payloads in HTML and scripts and compile cleanly', () => {
    const hostileId = `x'</script><img src=x onerror=alert(1)>`;
    const listHtml = pagesListTemplate(hostileId, '<option value="DRAFT">DRAFT</option>', '');
    const editorHtml = pageEditorTemplate(hostileId, hostileId, '', '', '', '');

    expect(listHtml).not.toContain('<img src=x onerror=alert(1)>');
    expect(editorHtml).not.toContain('<img src=x onerror=alert(1)>');
    expect(editorHtml).not.toContain(`const pageId = '${hostileId}'`);
    expect(listHtml).toContain('escapeHtml(page.title');
    expect(editorHtml).toContain('\\u003c/script\\u003e');

    for (const script of [...extractScripts(listHtml), ...extractScripts(editorHtml)]) {
      expect(() => new Function(script)).not.toThrow();
    }
  });

  it('SECTION_DEFINITIONS and renderPageDocument neutralize unclosed tags, nested tags, and javascript: URLs', () => {
    const richSchema = SECTION_DEFINITIONS[PageSectionType.RICH_TEXT].schema;
    const parsedRich = richSchema.parse({
      title: '<script>alert(1)</script>',
      blocks: [
        { type: 'paragraph', text: '<img src=x onerror=alert(1)//<b>Keep</b>', allowHtml: true },
        { type: 'paragraph', text: '<scr<script>ipt>alert(1)</script>', allowHtml: false },
        {
          type: 'paragraph',
          text: '<a href="javascript:alert(1)" target="_blank">Bad</a> <a href="https://sayra.ir" target="_blank"><b>Safe</b></a>',
          allowHtml: true,
        },
      ],
    });

    const rendered = renderPageDocument({
      title: 'Test Page',
      pageId: 'page-1',
      sections: [
        {
          type: PageSectionType.RICH_TEXT,
          dataJson: JSON.stringify(parsedRich),
        },
        {
          type: PageSectionType.HERO,
          dataJson: JSON.stringify({
            headline: 'Hero Title',
            subheadline: 'Sub',
            backgroundImageUrl: 'https://cdn.example.com/a.jpg',
            primaryCta: { label: 'Bad', url: 'javascript:alert(1)' },
            secondaryCta: { label: 'Book', url: '/reservation' },
          }),
        },
      ],
    });

    expect(rendered).not.toContain('<img');
    expect(rendered).not.toContain('<script>alert(1)</script>');
    expect(rendered).not.toContain('javascript:alert');
    expect(rendered).toContain('https://sayra.ir');
    expect(rendered).toContain('target="_blank" rel="noopener noreferrer"><b>Safe</b>');
    expect(rendered).not.toContain('rel="noopener noreferrer" rel="noopener noreferrer"');
    expect(rendered).toContain('<b>Safe</b>');
    // Hostile Hero schema rejected by Zod inside page-renderer
    expect(rendered).toContain("We couldn't load the HERO section.");

    // Direct renderer call ALSO neutralizes javascript:, data:, and CSS-breaking URLs
    const heroHtml = SECTION_DEFINITIONS[PageSectionType.HERO].renderer({
      headline: 'Hero Title',
      subheadline: 'Sub',
      backgroundImageUrl: "https://cdn.example.com/a.jpg');background:red",
      primaryCta: { label: 'Bad', url: 'javascript:alert(1)' },
      secondaryCta: { label: 'Book', url: '/reservation' },
    });
    expect(heroHtml).not.toContain('javascript:alert');
    expect(heroHtml).not.toContain('background:red');
    expect(heroHtml).toContain('href="/reservation"');

    const ctaHtml = SECTION_DEFINITIONS[PageSectionType.CTA].renderer({
      title: 'CTA',
      text: 'Go',
      buttonLabel: 'Click',
      buttonUrl: 'data:text/html,<script>alert(1)</script>',
    });
    expect(ctaHtml).not.toContain('data:text/html');
    expect(ctaHtml).not.toContain('<script>');

    // Direct schema validation rejects dangerous CTA and background URLs
    expect(() =>
      SECTION_DEFINITIONS[PageSectionType.HERO].schema.parse({
        headline: 'H',
        subheadline: 'S',
        primaryCta: { label: 'P', url: 'javascript:alert(1)' },
        secondaryCta: { label: 'S', url: '/ok' },
        backgroundImageUrl: 'https://example.com/bg.jpg',
      })
    ).toThrow();

    expect(() =>
      SECTION_DEFINITIONS[PageSectionType.CTA].schema.parse({
        title: 'T',
        text: 'Txt',
        buttonLabel: 'Btn',
        buttonUrl: 'javascript:alert(1)',
      })
    ).toThrow();
  });

  it('Ad slider script builds DOM nodes without innerHTML or inline onclick and compiles cleanly', () => {
    const html = renderPageDocument({ title: 'Public Page', sections: [] });
    expect(html).not.toContain('wrapper.innerHTML');
    expect(html).not.toContain('dotsElem.innerHTML');
    expect(html).not.toContain('onclick="window.open(');

    const scripts = extractScripts(html);
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(() => new Function(script)).not.toThrow();
    }
  });
});
