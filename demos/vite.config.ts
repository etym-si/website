import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { CSP, SECURITY_HEADERS } from './shared/csp.ts';
import { synthesizeEdgeTts, validateTtsParams } from './shared/edge-tts-live.ts';

// Strict CSP: everything is first-party; no inline scripts/styles, no eval, no third-party origins.
// (Styles are applied via CSSOM / Web Animations API only, which CSP allows.) blob: only for range-fetched audio.
// The Egyptian e2e build points these at a temporary content build via ETYM_* variables.
const GENERATED = process.env.ETYM_GENERATED_DIR ?? fileURLToPath(new URL('./src/generated', import.meta.url));
const KOKORO_CACHE_ROOT = path.resolve(fileURLToPath(new URL('./scripts/.cache/kokoro', import.meta.url)));

function serveKokoroAsset(req: IncomingMessage, res: ServerResponse): boolean {
  if (!req.url?.startsWith('/kokoro/')) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return true;
  }
  const u = new URL(req.url, 'http://localhost');
  const relPath = decodeURIComponent(u.pathname.slice('/kokoro/'.length));
  const resolved = path.resolve(KOKORO_CACHE_ROOT, relPath);
  // Strict directory boundary check against path traversal
  if (!resolved.startsWith(KOKORO_CACHE_ROOT + path.sep) || !existsSync(resolved)) {
    res.statusCode = 404;
    res.end('Not Found');
    return true;
  }
  const st = statSync(resolved);
  if (!st.isFile()) {
    res.statusCode = 404;
    res.end('Not Found');
    return true;
  }
  const ext = path.extname(resolved).toLowerCase();
  const mime =
    ext === '.wasm'
      ? 'application/wasm'
      : ext === '.mjs' || ext === '.js'
        ? 'text/javascript; charset=utf-8'
        : ext === '.json'
          ? 'application/json; charset=utf-8'
          : 'application/octet-stream';
  res.statusCode = 200;
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Length', String(st.size));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  createReadStream(resolved).pipe(res);
  return true;
}

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

const ttsMemoryCache = new Map<string, Uint8Array>();
const MAX_TTS_CACHE = 500;

async function handleApiTts(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end('Method Not Allowed');
    return;
  }
  const u = new URL(req.url ?? '/api/tts', 'http://localhost');
  const check = validateTtsParams(u.searchParams);
  if (!check.ok) {
    res.statusCode = check.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify({ error: check.error }));
    return;
  }
  const cacheKey = `${check.voice}|${check.rate}|${check.text}`;
  const cached = ttsMemoryCache.get(cacheKey);
  if (cached) {
    ttsMemoryCache.delete(cacheKey);
    ttsMemoryCache.set(cacheKey, cached);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(cached.byteLength));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-TTS-Cache', 'HIT');
    res.end(req.method === 'HEAD' ? undefined : cached);
    return;
  }
  try {
    const mp3 = await synthesizeEdgeTts({ voice: check.voice, rate: check.rate, text: check.text });
    ttsMemoryCache.set(cacheKey, mp3);
    if (ttsMemoryCache.size > MAX_TTS_CACHE) {
      const oldest = ttsMemoryCache.keys().next().value;
      if (oldest) ttsMemoryCache.delete(oldest);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(mp3.byteLength));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-TTS-Cache', 'MISS');
    res.end(req.method === 'HEAD' ? undefined : mp3);
  } catch {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify({ error: 'Upstream TTS synthesis failed' }));
  }
}

/** Serve multi-member .pack.gz shards as raw application/octet-stream so HTTP 206 byte ranges can be
 *  decompressed per-member via DecompressionStream('gzip') in the browser, and serve /api/tts dynamically. */
function rawPacks(): Plugin {
  const hook = (middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void }) => {
    middlewares.use((req, res, next) => {
      if (serveKokoroAsset(req, res)) return;
      if (req.url?.startsWith('/api/tts')) {
        void handleApiTts(req, res);
        return;
      }
      if (req.url?.includes('/data/packs/') && req.url.endsWith('.pack.gz')) {
        const origSet = res.setHeader.bind(res);
        res.setHeader = ((name: string, value: number | string | readonly string[]) => {
          if (name.toLowerCase() === 'content-encoding') return res;
          return origSet(name, value);
        }) as typeof res.setHeader;
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
