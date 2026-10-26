// End-to-end smoke on the production build (vite preview, 127.0.0.1): real CSP, headers and Range support.
// Requires `npm run build` first. Zero console/CSP errors; every audio section request answered with 206.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Browser, Page } from 'playwright';
import { parse } from 'yaml';
import { DEMOS, REPO } from '../../tools/paths.ts';
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
      await p.route('**/data/packs/**', async (route) => {
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

/** Answer every exercise correctly (the same moves as scripts/shoot.mjs), tracing 日 with the mouse. */
async function playLesson(p: Page): Promise<void> {
  const cont = () => p.locator('.lesson-footer button:not([disabled])').click({ timeout: 45000 });
  for (let step = 0; step < 20; step++) {
    await p.waitForTimeout(600);
    if (await p.locator('.results').count()) return;
    if (await p.locator('.meet-card').count()) {
      await p.locator('.meet-card.show').waitFor({ timeout: 60000 });
    } else if (await p.locator('.order').count()) {
      await p.locator('.order-card').first().waitFor();
      for (let k = 0; k < 4; k++) {
        const card = p.locator(`.order-pool .order-card[data-i="${k}"]`);
        if (await card.count()) await card.click();
      }
    } else if (await p.locator('.match').count()) {
      await p.waitForTimeout(500);
      const keys = await p.locator('.match-card.modern').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.c ?? ''));
      for (const k of keys) {
        await p.locator(`.match-card.ancient[data-c="${k}"]`).click();
        await p.locator(`.match-card.modern[data-c="${k}"]`).click();
      }
    } else if (await p.locator('.trace-box').count()) {
      await p.waitForTimeout(800);
      const box = (await p.locator('.trace-box svg').boundingBox())!;
      const data = JSON.parse(readFileSync(path.join(DEMOS, 'node_modules', 'hanzi-writer-data', '日.json'), 'utf8')) as { medians: [number, number][][] };
      const scale = (260 - 28) / 1024;
      const toScreen = ([x, y]: [number, number]) => [box.x + 14 + x * scale, box.y + 260 - (124 * scale + 14) - y * scale];
      for (const median of data.medians) {
        const pts = median.map(toScreen);
        await p.mouse.move(pts[0][0], pts[0][1]);
        await p.mouse.down();
        for (const q of pts.slice(1)) await p.mouse.move(q[0], q[1], { steps: 6 });
        await p.mouse.up();
        await p.waitForTimeout(350);
      }
    } else {
      const answer = await p.locator('.choices').getAttribute('data-answer');
      await p.locator('.choice', { hasText: answer ?? '' }).first().click();
    }
    await cont();
  }
  throw new Error('the lesson did not reach the results screen');
}

test('a lesson plays through on its legacy route, and its stickers land in the book', async () => {
  const page = await browser.newPage({ viewport: { width: 1180, height: 860 } });
  const w = await watchPage(page);
  await page.goto(`${server.url}#/lesson/u1-l1`);
  await playLesson(page);
  assert.match(await page.locator('.new-stickers').textContent() ?? '', /日.*山|山.*日/);
  await page.goto(`${server.url}#/book`);
  await page.locator('.sticker.got').nth(1).waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.sticker.got').count(), 2);
  await page.close();
  assert.deepEqual(w.problems, []);
  assert.ok(w.mp3.length >= 1 && w.mp3.every((r) => r.status === 206), JSON.stringify(w.mp3));
});

test('the learning path lists the units of the default collection', async () => {
  await visit('#/learn', async (p) => {
    await p.locator('.unit').first().waitFor();
    assert.equal(await p.locator('.unit').count(), 6);
    assert.equal(await p.locator('.node.current').count(), 1);
  });
});

test('the first-500 collection: its path lists every unit, and a new sign plays in the theater', async () => {
  const read = (rel: string) => parse(readFileSync(path.join(REPO, 'content', rel), 'utf8')) as Record<string, unknown>;
  const units = read('collections/first-500/collection.yaml').units as { signs: string[] }[];
  const film = new Set((read('collections/film-36/collection.yaml').units as { signs: string[] }[]).flatMap((u) => u.signs));
  const id = units.flatMap((u) => u.signs).find((s) => !film.has(s) && (read(`systems/han/signs/${s}.yaml`).forms as { stage: string }[] | undefined)?.[0]?.stage === 'oracle');
  assert.ok(id, 'first-500 has a new sign with an oracle-bone form');
  await visit('#/learn/first-500', async (p) => {
    await p.locator('.unit').first().waitFor();
    assert.equal(await p.locator('.unit').count(), units.length);
    assert.equal(await p.locator('.tab').count(), 2);
  });
  const w = await visit(`#/theater/han/${encodeURIComponent(id)}`, async (p) => {
    await startTheater(p);
    await p.locator('.tl-station[data-stage="oracle"].current').waitFor({ timeout: 30000 });
  });
  assert.ok(w.mp3.length >= 1, `${id}: the sign's audio section was fetched`);
});

test('门 swings both door leaves open in the theater, and the Pack Inspector displays lazy-loaded .pack.gz slices', async () => {
  const w = await visit('#/theater/han/%E9%97%A8', async (p) => {
    await startTheater(p);
    await p.locator('.stage-box [data-part="leaf-l"]').waitFor({ timeout: 15000 });
    await p.locator('.stage-box [data-part="leaf-r"]').waitFor({ timeout: 15000 });
    await p.locator('.tl-station[data-stage="oracle"].current').waitFor({ timeout: 30000 });
    await p.locator('.pack-pill').click();
    await p.locator('.pack-dialog').waitFor({ timeout: 5000 });
    assert.ok((await p.locator('.pack-shard-row').count()) >= 6, 'pack inspector lists the .pack.gz shards');
    assert.ok((await p.locator('.pack-log-row').count()) >= 2, 'pack inspector logs the lazy-loaded protobuf and audio slices');
  });
  assert.ok(w.mp3.length >= 2 && w.mp3.every((r) => r.status === 206), 'all .pack.gz range requests returned 206 Partial Content');
});
