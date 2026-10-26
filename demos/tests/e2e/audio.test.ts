// Section playback: Range requests answered with 206, Blob URLs, clip seek/stop, fallback when Range is ignored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DEMOS } from '../../tools/paths.ts';
import { launchChromium } from '../helpers/browser.ts';
import { runNode, startDev, watchPage } from '../helpers/server.ts';

test('a sign section is range-fetched and its pronunciation clip plays and stops on time', async () => {
  if (!existsSync(path.join(DEMOS, 'public', 'data', 'packs'))) runNode(['tools/build-content.ts']);
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
    await page.route('**/data/packs/**', async (route) => {
      const res = await route.fetch({ headers: {} }); // drop the Range header: 200 with the whole file
      await route.fulfill({ status: 200, body: await res.body(), headers: { 'content-type': 'application/octet-stream' } });
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

test('a clip whose audio clock stalls or crawls is cut at its length plus slack; paused time does not count', async () => {
  const dev = await startDev();
  const browser = await launchChromium(['--autoplay-policy=no-user-gesture-required']);
  try {
    const page = await browser.newPage();
    const w = await watchPage(page);
    await page.goto(`${dev.url}tests/e2e/harness/audio.html`);
    const r = await page.evaluate(async () => {
      const load = (u: string) => import(/* @vite-ignore */ u);
      const [{ findSign, loadSign }, audio] = await Promise.all([load('/src/content.ts'), load('/src/audio.ts')]);
      const b = await loadSign((await findSign('han/马')).summary);
      const section = await audio.prepareSection(b.audio, 'en');
      const [ms, dur] = section.clips[b.clip] as [number, number];
      const el = section.audio as HTMLAudioElement;
      const sleep = (n: number) => new Promise((res) => setTimeout(res, n));
      // Media time comes from the host's audio output, which can stall or crawl (seen with WSLg's sound server).
      // Stand in for the element's transport and clock: media time runs at `rate` × real time while playing.
      const fake = (rate: number, starts = true) => {
        let t = 0;
        let paused = true;
        let last = performance.now();
        const now = () => {
          const n = performance.now();
          if (!paused) t += ((n - last) / 1000) * rate;
          last = n;
          return t;
        };
        Object.defineProperties(el, {
          paused: { configurable: true, get: () => paused },
          currentTime: { configurable: true, get: now, set: (v: number) => { now(); t = v; } },
          play: { configurable: true, value: () => { now(); paused = false; return starts ? Promise.resolve() : new Promise(() => {}); } },
          pause: { configurable: true, value: () => { now(); paused = true; } },
        });
      };
      const run = async (during?: () => Promise<void>) => {
        const t0 = performance.now();
        const p = audio.speakLine(section, b.clip, '马', 'zh').then(() => false);
        await during?.();
        const hung = await Promise.race([p, sleep(20000).then(() => true)]);
        return { hung, took: Math.round(performance.now() - t0), at: el.currentTime * 1000 };
      };
      fake(0.1); // a tenth of real time: uncapped, the clip would take ten times its length
      const crawl = await run();
      fake(0, false); // play() never settles and the clock never moves
      const stuck = await run();
      fake(1); // a healthy clock, paused for 3 s halfway through
      const paused = await run(async () => {
        await sleep(dur / 2);
        audio.pauseSpeech();
        await sleep(3000);
        audio.resumeSpeech();
      });
      return { dur, clipEnd: ms + dur, crawl, stuck, paused };
    });
    assert.ok(!r.crawl.hung && r.crawl.took >= r.dur && r.crawl.took <= r.dur + 2500, `crawling clock: ${JSON.stringify(r)}`);
    assert.ok(!r.stuck.hung && r.stuck.took <= r.dur + 2500, `stuck clock: ${JSON.stringify(r)}`);
    assert.ok(!r.paused.hung && r.paused.took >= r.dur + 2900 && r.paused.at >= r.clipEnd, `played to its end after the pause: ${JSON.stringify(r)}`);
    assert.deepEqual(w.problems, []);
  } finally {
    await browser.close();
    await dev.close();
  }
});
