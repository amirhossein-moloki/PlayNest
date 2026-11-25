/**
 * HTML and URL sanitization utilities shared across SSR templates and client-side scripts.
 */

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeHttpOrRelativeUrl(
  url: unknown,
  options?: { allowMailto?: boolean; allowTel?: boolean; allowHash?: boolean }
): string | null {
  if (typeof url !== 'string') return null;
  const cleaned = url.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!cleaned) return null;
  if (/^\/(?!\/)/.test(cleaned)) {
    return cleaned;
  }
  if (options?.allowHash && cleaned.startsWith('#')) {
    return cleaned;
  }
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return cleaned;
    }
    if (options?.allowMailto && parsed.protocol === 'mailto:') {
      return cleaned;
    }
    if (options?.allowTel && parsed.protocol === 'tel:') {
      return cleaned;
    }
  } catch {
    return null;
  }
  return null;
}

export function sanitizeUrl(url: unknown, fallback = '#'): string {
  const valid = sanitizeHttpOrRelativeUrl(url);
  return valid ? escapeHtml(valid) : fallback;
}

export function serializeForScript(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export const CLIENT_HTML_SANITIZE_HELPERS = String.raw`
    function escapeHtml(value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
    function sanitizeUrl(url, fallback) {
      var fb = typeof fallback === 'string' ? fallback : '#';
      if (typeof url !== 'string') return fb;
      var cleaned = url.replace(/[\u0000-\u001F\u007F]/g, '').trim();
      if (!cleaned) return fb;
      if (/^\/(?!\/)/.test(cleaned)) return escapeHtml(cleaned);
      if (/^https?:\/\//i.test(cleaned)) return escapeHtml(cleaned);
      return fb;
    }
    function escapeJsArg(value) {
      return escapeHtml(
        String(value === null || value === undefined ? '' : value)
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/[\r\n]/g, '')
      );
    }
`;
