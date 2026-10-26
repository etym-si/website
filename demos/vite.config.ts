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

/** Serve multi-member .pack.gz shards as raw application/octet-stream so HTTP 206 byte ranges can be
 *  decompressed per-member via DecompressionStream('gzip') in the browser. */
function rawPacks(): Plugin {
  const hook = (middlewares: { use: (fn: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; removeHeader: (k: string) => void }, next: () => void) => void) => void }) => {
    middlewares.use((req, res, next) => {
      if (req.url?.includes('/data/packs/') && req.url.endsWith('.pack.gz')) {
        const origSet = res.setHeader.bind(res);
        res.setHeader = (name: string, value: string) => {
          if (name.toLowerCase() === 'content-encoding') return res;
          return origSet(name, value);
        };
        res.removeHeader('Content-Encoding');
        origSet('Content-Type', 'application/octet-stream');
      }
      next();
    });
  };
  return {
    name: 'raw-packs',
    configureServer(server) { hook(server.middlewares); },
    configurePreviewServer(server) { hook(server.middlewares); },
  };
}

export default defineConfig({
  base: './', // relative asset URLs: works on a LAN IP, a sub-path, or a custom domain
  publicDir: process.env.ETYM_PUBLIC_DIR ?? 'public',
  resolve: { alias: { '@generated': GENERATED } },
  plugins: [cspMeta(), rawPacks()],
  build: { target: 'es2022', chunkSizeWarningLimit: 900, outDir: process.env.ETYM_OUT_DIR ?? 'dist', emptyOutDir: true },
  preview: {
    // Same headers as Cloudflare's generated _headers.
    headers: { 'Content-Security-Policy': `${CSP}; frame-ancestors 'none'`, ...SECURITY_HEADERS },
  },
});
