// End-to-end smoke on the production build (vite preview, 127.0.0.1): real CSP, headers and Range support.
// Requires `npm run build` first. Zero console/CSP errors; every audio section request answered with 206.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Browser, Page } from 'playwright';
import { DEMOS } from '../../tools/paths.ts';
import { launchChromium } from '../helpers/browser.ts';
import { startTheater } from '../helpers/player.ts';
import { startPreview, watchPage } from '../helpers/server.ts';

const DIST = path.join(DEMOS, 'dist');
let server: { url: string; close: () => Promise<void> };
let browser: Browser;

before(async () => {
  if (!existsSync(path.join(DIST, 'index.html'))) throw new Error('run npm run build before npm run test:e2e');
  server = await startPreview(DIST);
  browser = await launchChromium(['--autoplay-policy=no-user-gesture-required']);
});
after(async () => {
  await browser?.close();
  await server?.close();
});

async function visit(hash: string, act: (page: Page) => Promise<void>, prepare?: (page: Page) => Promise<void>): Promise<{ mp3: { url: string; status: number }[] }> {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const w = await watchPage(page);
  await prepare?.(page);
  await page.goto(server.url + hash);
  await act(page);
  await page.close();
  assert.deepEqual(w.problems, [], `${hash}\n${w.problems.join('\n')}`);
  assert.ok(w.mp3.every((r) => r.status === 206), `${hash}: ${JSON.stringify(w.mp3)}`);
  return w;
}

test('home renders and loops the teaser', async () => {
  await visit('#/', async (p) => {
    await p.locator('.cards').waitFor();
    await p.locator('.teaser .actor').first().waitFor({ timeout: 20000 });
  });
});

test('the theater plays on the namespaced route and the legacy route', async () => {
  for (const hash of ['#/theater/han/%E9%A9%AC', '#/theater/%E9%A9%AC']) {
    const w = await visit(hash, async (p) => {
      await startTheater(p);
      await p.locator('.tl-station[data-stage="oracle"].current').waitFor({ timeout: 30000 });
      await p.locator('.artifact-card:not(.hidden)').waitFor({ timeout: 10000 });
      assert.match(p.url(), /#\/theater\/han\/%E9%A9%AC$/);
    });
    assert.ok(w.mp3.length >= 1, `${hash}: the sign's audio section was fetched`);
  }
});

test('a tap on the theater overlay while the collection is still loading is never lost', async () => {
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  try {
    await visit('#/theater/han/%E9%A9%AC', async (p) => {
      await p.locator('.start-overlay').click(); // the collection response is held back: nothing has loaded yet
      await p.locator('.start-overlay').waitFor({ state: 'detached', timeout: 2000 }); // the tap was taken at once
      release();
      await p.locator('.tl-station[data-stage="picture"].current').waitFor({ timeout: 15000 }); // and the theater plays
    }, async (p) => {
      await p.route('**/data/collections/**', async (route) => {
        await held;
        await route.continue();
      });
    });
  } finally {
    release();
  }
});

test('stories 1–6 start from their legacy numeric routes and fetch their audio section', async () => {
  for (let n = 1; n <= 6; n++) {
    const w = await visit(`#/story/${n}`, async (p) => {
      await p.locator('.start-overlay').click();
      await p.locator('.stage-box .actor .glyph').first().waitFor({ timeout: 30000 });
    });
    assert.ok(w.mp3.length >= 1, `story ${n} audio`);
  }
});
