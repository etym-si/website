// Dev tool: visual check of the picture illustrations (src/pictures.ts) and the mascot.
//
//   node scripts/preview-pictures.mjs            → shots/pictures.png + shots/pictures-overlay.png
//   node scripts/preview-pictures.mjs --frames   → also shots/pictures-ambient.png (CSS ambient motion, 4 moments)
//   node scripts/preview-pictures.mjs --zoom=日鸟@ → also shots/pictures-zoom.png (close-ups; "@" = mascot)
//
// Starts a throwaway Vite dev server on 127.0.0.1:3737 (ignores vite.config.ts; no HMR, no file watching),
// serves a preview page from memory (no temp files), screenshots it with Playwright, then shuts everything down.
// Not part of the app bundle.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3737;
const withFrames = process.argv.includes('--frames');
const zoom = (process.argv.find((a) => a.startsWith('--zoom=')) || '').slice('--zoom='.length);

/**
 * Runs in the browser (serialized with Function#toString). Builds the preview with createElementNS
 * through the app's own s()/h() helpers — no innerHTML anywhere.
 */
async function client({ PICTURES, buildMascot, s, h }) {
  const mode = new URLSearchParams(location.search).get('mode') || 'grid';
  const ORDER = [...'日山水林木鸟象草田竹马夫'];
  const STAGES = ['oracle', 'bronze', 'seal', 'clerical'];
  const app = document.getElementById('app');
  const box = (size, vb) => s('svg', { width: size, height: size, viewBox: `0 0 ${vb} ${vb}` });
  const fig = (el, label) => h('figure', {}, el, h('figcaption', {}, label));
  const caption = (ch, d) => `${ch} · rotate ${d.rotate}${d.ambient ? ` · ${d.ambient}` : ''}`;

  if (mode === 'grid') {
    app.append(h('h2', {}, 'Pictures at 300px (natural pose, no rotation)'));
    const big = h('div', { class: 'grid' });
    for (const ch of ORDER) {
      const el = box(300, 300);
      el.append(PICTURES[ch].build());
      big.append(fig(el, caption(ch, PICTURES[ch])));
    }
    const m = box(300, 200);
    m.append(buildMascot());
    big.append(fig(m, 'Gugu the turtle (200×200 box)'));
    app.append(big);
    app.append(h('h2', {}, 'At 120px'));
    const small = h('div', { class: 'strip' });
    for (const ch of ORDER) {
      const el = box(120, 300);
      el.append(PICTURES[ch].build());
      small.append(fig(el, ch));
    }
    const m2 = box(120, 200);
    m2.append(buildMascot());
    small.append(fig(m2, 'Gugu'));
    app.append(small);
  } else if (mode === 'overlay') {
    app.append(h('h2', {}, 'Rotated picture + earliest glyph at 50% opacity'));
    const grid = h('div', { class: 'grid' });
    for (const ch of ORDER) {
      const d = PICTURES[ch];
      const doc = await (await fetch(`/glyphs/${encodeURIComponent(ch)}.json`)).json();
      const st = STAGES.map((k) => doc.stages.find((x) => x.stage === k)).find(Boolean);
      const [bx, by, bw, bh] = st.box;
      const sc = 300 / Math.max(bw, bh);
      const ox = (300 - bw * sc) / 2;
      const oy = (300 - bh * sc) / 2;
      const paths = st.paths.map((p) => s('path', {
        d: p.d,
        transform: p.t,
        fill: p.mode === 'stroke' ? 'none' : p.mode === 'knockout' ? '#fff' : '#000',
        stroke: p.mode === 'stroke' ? '#000' : undefined,
        'stroke-width': p.mode === 'stroke' ? p.w : undefined,
        'fill-rule': p.rule ? 'evenodd' : undefined,
      }));
      const el = box(300, 300);
      el.append(
        s('g', { transform: `rotate(${d.rotate} 150 150)` }, d.build()),
        s('g', { transform: `translate(${ox} ${oy}) scale(${sc}) translate(${-bx} ${-by})`, opacity: 0.5 }, ...paths),
      );
      grid.append(fig(el, `${ch} · ${st.stage}${st.stage === 'oracle' ? '' : ' (no oracle form)'} · rotate ${d.rotate}`));
    }
    app.append(grid);
  } else if (mode === 'ambient') {
    // Same pictures with the CSS ambient motion switched on; the screenshot script samples a few moments.
    const strip = h('div', { class: 'strip ambient-on' });
    for (const ch of ['日', '水', '鸟']) {
      const el = box(200, 300);
      el.append(PICTURES[ch].build());
      strip.append(fig(el, ch));
    }
    const m = box(200, 200);
    m.append(buildMascot());
    strip.append(fig(m, 'Gugu'));
    app.append(strip);
  } else if (mode === 'zoom') {
    // Close-up of selected pictures at 560px (use "@" for the mascot).
    const only = [...(new URLSearchParams(location.search).get('only') || '')];
    const grid = h('div', { class: 'zoom' });
    for (const ch of only) {
      const isMascot = ch === '@';
      const el = box(560, isMascot ? 200 : 300);
      el.append(isMascot ? buildMascot() : PICTURES[ch].build());
      grid.append(fig(el, isMascot ? 'Gugu' : caption(ch, PICTURES[ch])));
    }
    app.append(grid);
  }
  window.__ppReady = true;
}

const STYLE = `
  body { margin: 0; padding: 18px; background: #f7f0e1; color: #3a2e2a; font: 14px/1.3 system-ui, sans-serif; }
  h2 { margin: 6px 0 12px; font-size: 16px; }
  .grid { display: grid; grid-template-columns: repeat(5, 300px); gap: 14px; margin-bottom: 18px; }
  .strip { display: flex; flex-wrap: wrap; gap: 10px; }
  .zoom { display: grid; grid-template-columns: repeat(2, 560px); gap: 14px; }
  figure { margin: 0; padding: 6px; background: #fffaf0; border-radius: 14px; box-shadow: 0 1px 0 #e3d7bd; }
  figcaption { padding: 4px 0 2px; text-align: center; font-size: 13px; }
  svg { display: block; overflow: visible; }
`;

const HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>pictures preview</title>
<link rel="stylesheet" href="/src/pictures.css">
<style>${STYLE}</style></head>
<body><div id="app"></div>
<script type="module">
import { PICTURES, buildMascot } from '/src/pictures.ts';
import { s, h } from '/src/dom.ts';
(${client.toString()})({ PICTURES, buildMascot, s, h }).catch((e) => { window.__ppError = String(e && e.stack || e); });
</script></body></html>`;

/** Serves the preview page from memory. */
function previewPage() {
  return {
    name: 'preview-pictures',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/preview-pictures.html')) return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(HTML);
      });
    },
  };
}

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'warn',
  appType: 'custom',
  plugins: [previewPage()],
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false, watch: null },
});

let browser;
try {
  await server.listen();
  browser = await launch();
  mkdirSync(join(root, 'shots'), { recursive: true });

  const shoot = async (mode, file, { frames = 0, query = '' } = {}) => {
    const page = await browser.newPage({ viewport: { width: 1620, height: 900 }, deviceScaleFactor: 1 });
    const problems = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`); });
    await page.goto(`http://127.0.0.1:${PORT}/preview-pictures.html?mode=${mode}${query}`);
    await page.waitForFunction(() => window.__ppReady === true || typeof window.__ppError === 'string', null, { timeout: 20000 });
    const err = await page.evaluate(() => window.__ppError);
    if (err) throw new Error(`preview failed (${mode}):\n${err}`);
    if (frames) {
      // Stack a few moments of the ambient animation vertically into one image.
      const shots = [];
      for (let i = 0; i < frames; i++) {
        await page.waitForTimeout(i === 0 ? 50 : 420);
        shots.push((await page.locator('#app').screenshot()).toString('base64'));
      }
      const sheet = await browser.newPage({ viewport: { width: 1000, height: 300 * frames } });
      await sheet.setContent('<body style="margin:0;background:#fff"></body>');
      await sheet.evaluate((list) => {
        for (const b64 of list) {
          const img = document.createElement('img');
          img.src = `data:image/png;base64,${b64}`;
          img.style.display = 'block';
          document.body.appendChild(img);
        }
      }, shots);
      await sheet.waitForFunction(() => [...document.images].every((i) => i.complete));
      await sheet.screenshot({ path: join(root, 'shots', file), fullPage: true });
      await sheet.close();
    } else {
      await page.screenshot({ path: join(root, 'shots', file), fullPage: true });
    }
    await page.close();
    for (const p of problems) console.warn(`[${mode}] ${p}`);
    console.log('wrote', join('shots', file));
  };

  await shoot('grid', 'pictures.png');
  await shoot('overlay', 'pictures-overlay.png');
  if (withFrames) await shoot('ambient', 'pictures-ambient.png', { frames: 4 });
  if (zoom) await shoot('zoom', 'pictures-zoom.png', { query: `&only=${encodeURIComponent(zoom)}` });
} finally {
  await browser?.close();
  await server.close();
}
