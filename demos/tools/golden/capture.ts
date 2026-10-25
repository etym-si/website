// One-off: record today's behaviour before anything changes (spec §10 "Golden parity").
// Starts a Vite dev server on 127.0.0.1 (no config file, no HMR), opens a same-origin page in headless Chromium,
// dynamically imports the CURRENT modules and serializes their outputs into tests/golden/*.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { DEMOS, GOLDEN_DIR } from '../paths.ts';
import { launchChromium } from '../../tests/helpers/browser.ts';

const PORT = 3690;

/** Runs inside the page. Module specifiers are passed as data so TypeScript does not try to resolve them. */
async function captureInPage(urls: Record<string, string>): Promise<Record<string, unknown>> {
  const load = (u: string) => import(/* @vite-ignore */ u);
  const [scripts, chars, glyphs, artifacts, pictures, i18n, stages, stories] = await Promise.all([
    load(urls.scripts), load(urls.chars), load(urls.glyphs), load(urls.artifacts),
    load(urls.pictures), load(urls.i18n), load(urls.stages), load(urls.stories),
  ]);
  const ser = new XMLSerializer();
  const evolution: Record<string, unknown> = {};
  const cards: Record<string, unknown> = {};
  const pics: Record<string, unknown> = {};
  for (const info of chars.CHARS) {
    const ch: string = info.char;
    const doc = await glyphs.loadGlyph(ch);
    evolution[ch] = { full: scripts.evolutionScript(doc), compact: scripts.evolutionScript(doc, { compact: true }) };
    const pic = pictures.PICTURES[ch];
    const events: { stage: string; hist: unknown }[] = [];
    if (pic) events.push({ stage: 'picture', hist: undefined });
    for (const st of doc.stages) events.push({ stage: st.stage, hist: st });
    events.push({ stage: 'regular', hist: undefined });
    if (doc.trad !== doc.char) events.push({ stage: 'simplified', hist: undefined });
    const perScript: Record<string, unknown> = {};
    for (const script of ['simp', 'trad']) {
      const disp = chars.displayChar(info, script);
      const seen: Record<string, number> = {};
      perScript[script] = events.map(({ stage, hist }) => {
        const index = seen[stage] ?? 0;
        seen[stage] = index + 1;
        const ref = artifacts.artifactFor(ch, stage, hist, disp);
        if (!ref) return { stage, index, card: null };
        const form = ref.hist
          ? { stage: ref.hist.stage, index: doc.stages.filter((s: { stage: string }) => s.stage === ref.hist.stage).indexOf(ref.hist) }
          : undefined;
        return { stage, index, card: { kind: ref.kind, img: ref.img, img2: ref.img2, marks: ref.marks, form, disp: ref.disp, title: ref.title, text: ref.text, source: ref.source } };
      });
    }
    cards[ch] = perScript;
    if (pic) pics[ch] = { rotate: pic.rotate, ambient: pic.ambient ?? null, svg: ser.serializeToString(pic.build()) };
  }
  return {
    chars: chars.CHARS, stories: stories.CHAR_STORIES, evolution, cards, pictures: pics, chapters: scripts.CHAPTERS,
    strings: i18n.STR, stages: { stages: stages.STAGES, variantNotes: stages.VARIANT_NOTE }, units: { units: chars.UNITS, lessons: chars.LESSONS },
  };
}

const server = await createServer({
  root: DEMOS, configFile: false, appType: 'custom', logLevel: 'error',
  server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false, watch: null },
});
await server.listen();
const browser = await launchChromium();
try {
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/glyphs/index.json`); // any same-origin page that does not boot the app
  const out = await page.evaluate(captureInPage, {
    scripts: '/src/engine/scripts.ts', chars: '/src/data/chars.ts', glyphs: '/src/glyphs.ts', artifacts: '/src/data/artifacts.ts',
    pictures: '/src/pictures.ts', i18n: '/src/i18n.ts', stages: '/src/data/stages.ts', stories: '/src/data/char-stories.ts',
  });
  if (pageErrors.length) throw new Error(`page errors during capture:\n${pageErrors.join('\n')}`);
  mkdirSync(GOLDEN_DIR, { recursive: true });
  for (const [name, value] of Object.entries(out)) {
    writeFileSync(path.join(GOLDEN_DIR, `${name}.json`), JSON.stringify(value, null, 1) + '\n');
  }
  console.log(`golden: wrote ${Object.keys(out).length} files to ${GOLDEN_DIR}`);
} finally {
  await browser.close();
  await server.close();
}
