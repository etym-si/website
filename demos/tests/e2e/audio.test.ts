// Section playback: Range requests answered with 206, Blob URLs, clip seek/stop, fallback when Range is ignored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchChromium } from '../helpers/browser.ts';
import { runNode, startDev, watchPage } from '../helpers/server.ts';

test('a sign section is range-fetched and its pronunciation clip plays and stops on time', async () => {
  runNode(['tools/build-content.ts']);
  const dev = await startDev();
  const browser = await launchChromium(['--autoplay-policy=no-user-gesture-required']);
  try {
    const page = await browser.newPage();
    const w = await watchPage(page);
    await page.goto(`${dev.url}tests/e2e/harness/audio.html`);
    const r = await page.evaluate(async () => {
      const load = (u: string) => import(/* @vite-ignore */ u);
      const [{ findSign, loadSign }, audio] = await Promise.all([load('/src/content.ts'), load('/src/audio.ts')]);
      const found = await findSign('han/马');
      const b = await loadSign(found.summary);
      const section = await audio.prepareSection(b.audio, 'en');
      const [, dur] = section.clips[b.clip];
      const t0 = performance.now();
      await audio.speakLine(section, b.clip, '马', 'zh');
      const took = performance.now() - t0;
      return { dur, took, blob: section.url.startsWith('blob:'), stoppedAt: section.audio.currentTime * 1000, clipEnd: section.clips[b.clip][0] + dur };
    });
    assert.ok(r.blob);
    assert.ok(r.took >= r.dur * 0.8 && r.took <= r.dur + 1500, JSON.stringify(r));
    assert.ok(r.stoppedAt >= r.clipEnd && r.stoppedAt <= r.clipEnd + 240, `stopped inside the silent gap: ${JSON.stringify(r)}`);
    assert.ok(w.mp3.length >= 1 && w.mp3.every((x) => x.status === 206), JSON.stringify(w.mp3));
    assert.deepEqual(w.problems, []);
  } finally {
    await browser.close();
    await dev.close();
  }
});

test('when the server ignores Range, the full response is sliced; missing clips fall back to device speech', async () => {
  const dev = await startDev();
  const browser = await launchChromium(['--autoplay-policy=no-user-gesture-required']);
  try {
    const page = await browser.newPage();
    await page.route('**/*.mp3', async (route) => {
      const res = await route.fetch({ headers: {} }); // drop the Range header: 200 with the whole file
      await route.fulfill({ status: 200, body: await res.body(), headers: { 'content-type': 'audio/mpeg' } });
    });
    await page.goto(`${dev.url}tests/e2e/harness/audio.html`);
    const r = await page.evaluate(async () => {
      const load = (u: string) => import(/* @vite-ignore */ u);
      const [{ findSign, loadSign }, audio] = await Promise.all([load('/src/content.ts'), load('/src/audio.ts')]);
      const b = await loadSign((await findSign('han/日')).summary);
      const section = await audio.prepareSection(b.audio, 'zh-Hans');
      await audio.speakLine(section, b.clip, '日', 'zh');
      const t0 = performance.now();
      await audio.speakLine(section, 'no-such-clip', 'hello', 'en'); // device speech (or its timeout) instead
      return { hasClip: !!section.clips[b.clip], fallbackMs: performance.now() - t0 };
    });
    assert.ok(r.hasClip);
    assert.ok(r.fallbackMs < 8000);
  } finally {
    await browser.close();
    await dev.close();
  }
});
