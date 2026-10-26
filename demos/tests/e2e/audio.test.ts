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

test('a section evicted while playing has its URL revoked after the clip finishes', async () => {
  const dev = await startDev();
  const browser = await launchChromium(['--autoplay-policy=no-user-gesture-required']);
  try {
    const page = await browser.newPage();
    const w = await watchPage(page);
    await page.goto(`${dev.url}tests/e2e/harness/audio.html`);
    const r = await page.evaluate(async () => {
      const load = (u: string) => import(/* @vite-ignore */ u);
      const [{ findSign, loadSign }, audio] = await Promise.all([load('/src/content.ts'), load('/src/audio.ts')]);
      const revoked: string[] = [];
      const origRevoke = URL.revokeObjectURL;
      URL.revokeObjectURL = (url: string) => {
        revoked.push(url);
        origRevoke.call(URL, url);
      };

      const found = await findSign('han/马');
      const b = await loadSign(found.summary);
      const section = await audio.prepareSection(b.audio, 'en');
      const url = section.url;

      // Start playing
      const playPromise = audio.speakLine(section, b.clip, '马', 'zh');

      // Evict section from LRU while playing by preparing 7 other sections
      const signsList = Object.values(found.collection.signs) as Array<{ key: string }>;
      const others = signsList.filter((s) => s.key !== 'han/马').slice(0, 7);
      for (const s of others) {
        const loaded = await loadSign(s);
        await audio.prepareSection(loaded.audio, 'en');
      }

      const revokedWhilePlaying = revoked.includes(url);
      await playPromise;
      const revokedAfterFinish = revoked.includes(url);
      const srcAfterFinish = section.audio.getAttribute('src');

      // Also verify eviction cleanup when playback is cancelled
      const found2 = await findSign('han/日');
      const b2 = await loadSign(found2.summary);
      const section2 = await audio.prepareSection(b2.audio, 'en');
      const url2 = section2.url;
      const playPromise2 = audio.speakLine(section2, b2.clip, '日', 'zh');
      for (const s of others) {
        const loaded = await loadSign(s);
        await audio.prepareSection(loaded.audio, 'en');
      }
      audio.cancelSpeech();
      await playPromise2;
      const revokedAfterCancel = revoked.includes(url2);
      const srcAfterCancel = section2.audio.getAttribute('src');

      return { revokedWhilePlaying, revokedAfterFinish, srcAfterFinish, revokedAfterCancel, srcAfterCancel };
    });

    assert.equal(r.revokedWhilePlaying, false, 'must not revoke URL while clip is active');
    assert.equal(r.revokedAfterFinish, true, 'must revoke URL once clip finishes');
    assert.equal(r.srcAfterFinish, null, 'src attribute must be removed');
    assert.equal(r.revokedAfterCancel, true, 'must revoke URL when clip is cancelled');
    assert.equal(r.srcAfterCancel, null, 'src attribute must be removed on cancel');
    assert.deepEqual(w.problems, []);
  } finally {
    await browser.close();
    await dev.close();
  }
});

