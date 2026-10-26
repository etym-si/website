import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { CSP, SECURITY_HEADERS } from './shared/csp.ts';

// Strict CSP: everything is first-party; no inline scripts/styles, no eval, no third-party origins.
// (Styles are applied via CSSOM / Web Animations API only, which CSP allows.) blob: only for range-fetched audio.
// The Egyptian e2e build points these at a temporary content build via ETYM_* variables.
const GENERATED = process.env.ETYM_GENERATED_DIR ?? fileURLToPath(new URL('./src/generated', import.meta.url));

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
  base: './', // relative asset URLs: works on a LAN IP, a sub-path, or a custom domain
  publicDir: process.env.ETYM_PUBLIC_DIR ?? 'public',
  resolve: { alias: { '@generated': GENERATED } },
  plugins: [cspMeta()],
  build: { target: 'es2022', chunkSizeWarningLimit: 900, outDir: process.env.ETYM_OUT_DIR ?? 'dist', emptyOutDir: true },
  preview: {
    // Same headers as Cloudflare's generated _headers.
    headers: { 'Content-Security-Policy': `${CSP}; frame-ancestors 'none'`, ...SECURITY_HEADERS },
  },
});
