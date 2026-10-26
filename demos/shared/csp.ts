// One CSP for the build-time <meta> tag (vite.config.ts), the preview server and Cloudflare's generated _headers.
// blob: is allowed for media only: audio sections the app range-fetched from its own origin.
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' data: blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

/** Cloudflare Pages `_headers`: security headers everywhere, immutable caching for hashed assets and data, octet-stream for .pack.gz shards. */
export function headersFile(): string {
  const all = { 'Content-Security-Policy': `${CSP}; frame-ancestors 'none'`, ...SECURITY_HEADERS };
  const immutable = '  Cache-Control: public, max-age=31536000, immutable';
  return [
    '/*',
    ...Object.entries(all).map(([k, v]) => `  ${k}: ${v}`),
    '/assets/*',
    immutable,
    '/data/*',
    immutable,
    '/data/packs/*',
    '  Content-Type: application/octet-stream',
    '  Content-Encoding: identity',
    '',
  ].join('\n');
}
