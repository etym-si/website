import { defineConfig, type Plugin } from 'vite';

// Strict CSP: everything is first-party; no inline scripts/styles, no eval, no third-party origins.
// (Styles are applied via CSSOM / Web Animations API only, which CSP allows.)
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Inject the CSP <meta> into the production build only (Vite's dev server needs inline styles for HMR). */
function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return { html, tags: [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }] };
    },
  };
}

export default defineConfig({
  base: './', // relative asset URLs: works on a LAN IP, a GitHub Pages sub-path, or a custom domain
  plugins: [cspMeta()],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  preview: {
    // Real headers for the LAN preview (GitHub Pages can't set these; noted as TODO(security) in the spec).
    headers: {
      'Content-Security-Policy': `${CSP}; frame-ancestors 'none'`,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    },
  },
});
