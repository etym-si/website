// Chromium must decode packed sections exactly: silence between clips and a duration of frames × 24 ms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { packSections } from '../../tools/audio/pack.ts';
import { clipPath, readMediaManifest } from '../../tools/audio/media.ts';
import { MEDIA_DIR } from '../../tools/paths.ts';
import { launchChromium } from '../helpers/browser.ts';

test('packed sections decode in Chromium with exact length and silent gaps', async () => {
  const manifest = readMediaManifest(MEDIA_DIR);
  const [a, b] = Object.entries(manifest.clips).filter(([, c]) => c.voice.startsWith('zh-')).slice(0, 2).map(([k]) => k);
  const packed = packSections([{ id: 'zh', keys: [a, b] }], (k) => readFileSync(clipPath(MEDIA_DIR, k)), 10);
  const aMs = packed.clips[a].zh[1];
  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    const r = await page.evaluate(async ({ b64, aMs }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const buf = await new OfflineAudioContext(1, 24000, 24000).decodeAudioData(bin.buffer.slice(0));
      const d = buf.getChannelData(0);
      let gapMax = 0;
      for (let i = Math.round((aMs + 24) * 24); i < Math.round((aMs + 216) * 24); i++) gapMax = Math.max(gapMax, Math.abs(d[i]));
      return { ms: buf.duration * 1000, gapMax };
    }, { b64: Buffer.from(packed.bytes).toString('base64'), aMs });
    assert.equal(Math.round(r.ms), (packed.bytes.length / 144) * 24);
    assert.equal(r.gapMax, 0);
  } finally {
    await browser.close();
  }
});
