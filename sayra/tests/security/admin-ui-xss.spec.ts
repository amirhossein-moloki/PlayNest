/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from '@jest/globals';
import { platformAdminDashboardTemplate } from '../../src/modules/platform-admin/platform-admin-ui.templates';
import { platformAnalyticsDashboardTemplate } from '../../src/modules/platform-admin/platform-analytics-ui.templates';
import { dashboardTemplate } from '../../src/modules/analytics/dashboard-ui.templates';
import { escapeHtml, sanitizeUrl, CLIENT_HTML_SANITIZE_HELPERS } from '../../src/common/utils/html-sanitize';

function extractScripts(html: string): string[] {
  const matches: string[] = [];
  const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

describe('SEC-010: Platform Admin & Dashboard UI Stored XSS Remediation', () => {
  it('fixes the duplicate Promise.all syntax bug in dashboardTemplate and ensures valid JS syntax across all 3 templates', () => {
    const htmls = [
      platformAdminDashboardTemplate(),
      platformAnalyticsDashboardTemplate(),
      dashboardTemplate('gc-test-1'),
    ];

    for (const html of htmls) {
      const scripts = extractScripts(html);
      expect(scripts.length).toBeGreaterThan(0);
      for (const script of scripts) {
        if (script.trim().length > 0) {
          expect(() => new Function(script)).not.toThrow();
        }
      }
    }
  });

  it('provides escapeHtml, sanitizeUrl, and escapeJsArg helpers that neutralize XSS payloads and javascript: URLs', () => {
    const adminHtml = platformAdminDashboardTemplate();
    const analyticsHtml = platformAnalyticsDashboardTemplate();
    const dashHtml = dashboardTemplate('gc-test-1');
    for (const h of [adminHtml, analyticsHtml, dashHtml]) {
      expect(h).toContain('function escapeHtml(value)');
      expect(h).toContain('function sanitizeUrl(url, fallback)');
      expect(h).toContain('function escapeJsArg(value)');
    }

    // Test server utilities and injected client helpers
    const payload = `<img src=x onerror="alert('xss')">&`;
    const escaped = escapeHtml(payload);
    expect(escaped).toBe('&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;&amp;');
    expect(escaped).not.toContain('<img');

    expect(sanitizeUrl('javascript:alert(1)', '')).toBe('');
    expect(sanitizeUrl('  JaVaScRiPt:alert(1)', '')).toBe('');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>', '')).toBe('');
    expect(sanitizeUrl('//evil.example/payload.js', '')).toBe('');
    expect(sanitizeUrl('https://cdn.example.com/banner.png?w=200', '')).toBe(
      'https://cdn.example.com/banner.png?w=200'
    );
    expect(sanitizeUrl('/uploads/doc.png', '')).toBe('/uploads/doc.png');

    // Evaluate injected client-side helpers
    const fn = new Function(
      `${CLIENT_HTML_SANITIZE_HELPERS}; return { escapeHtml: escapeHtml, sanitizeUrl: sanitizeUrl, escapeJsArg: escapeJsArg };`
    );
    const clientHelpers = fn();
    expect(clientHelpers.escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
    expect(clientHelpers.sanitizeUrl('javascript:alert(document.cookie)', '')).toBe('');
    expect(clientHelpers.sanitizeUrl('https://sayra-booking.ir/a.png')).toBe(
      'https://sayra-booking.ir/a.png'
    );
    expect(clientHelpers.escapeJsArg("x');alert(1);//")).not.toContain("'x");
  });

  it('escapes all attacker-controlled entity fields and neutralizes unsafe URLs in all 3 templates', () => {
    const adminHtml = platformAdminDashboardTemplate();
    // Ensure key dangerous fields are wrapped with escapeHtml / sanitizeUrl / escapeJsArg
    expect(adminHtml).toContain('escapeHtml(c.name)');
    expect(adminHtml).toContain('escapeHtml(c.slug)');
    expect(adminHtml).toContain('escapeHtml(v.rejectionReason)');
    expect(adminHtml).toContain('sanitizeUrl(v.businessLicenseUrl');
    expect(adminHtml).toContain('sanitizeUrl(v.nationalCardUrl');
    expect(adminHtml).toContain('sanitizeUrl(a.bannerUrl');
    expect(adminHtml).toContain('escapeHtml(a.title)');
    expect(adminHtml).toContain('escapeHtml(u.fullName)');
    expect(adminHtml).toContain('escapeHtml(s.userAgent');
    expect(adminHtml).toContain("escapeJsArg(c.id)");
    expect(adminHtml).toContain("escapeJsArg(d.id)");
    // Ensure no unescaped bannerUrl/businessLicenseUrl attributes remain
    expect(adminHtml).not.toContain('href="\' + v.businessLicenseUrl');
    expect(adminHtml).not.toContain('src="\' + a.bannerUrl');

    const analyticsHtml = platformAnalyticsDashboardTemplate();
    expect(analyticsHtml).toContain("escapeHtml(c.name || 'Unknown')");
    expect(analyticsHtml).toContain("escapeHtml(c.slug || '-')");
    expect(analyticsHtml).toContain('escapeHtml(p.raw.date)');
    expect(analyticsHtml).toContain('escapeHtml(item.label)');

    const dashHtml = dashboardTemplate('center<script>alert(1)</script>');
    // Parameter gamingCenterId must be JSON-serialized rather than raw-interpolated
    expect(dashHtml).toContain('const gamingCenterId = ');
    expect(dashHtml).not.toContain("const gamingCenterId = 'center<script>");
    expect(dashHtml).toContain('escapeHtml(ad.title)');
    expect(dashHtml).toContain('sanitizeUrl(ad.bannerUrl');
    expect(dashHtml).toContain('escapeHtml(e.message)');
    expect(dashHtml).toContain('escapeHtml(sp.phone)');
  });
});
