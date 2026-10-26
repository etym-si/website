// Pictures rebuilt in the browser from compiled JSON trees must serialize exactly like today's PICTURES.build().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GOLDEN_DIR } from '../../tools/paths.ts';
import { launchChromium } from '../helpers/browser.ts';
import { runNode, startDev } from '../helpers/server.ts';

test('pictures rebuilt with createElementNS match the golden serialization', async () => {
  runNode(['tools/build-content.ts']);
  const golden = JSON.parse(readFileSync(path.join(GOLDEN_DIR, 'pictures.json'), 'utf8')) as Record<string, { svg: string }>;
  const dev = await startDev();
  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    await page.goto(`${dev.url}CREDITS.md`); // same origin, does not boot the app
    const out = await page.evaluate(async (chars: string[]) => {
      const load = (u: string) => import(/* @vite-ignore */ u);
      const [{ findSign, loadSign }, { buildPicture }] = await Promise.all([load('/src/content.ts'), load('/src/picture.ts')]);
      const ser = new XMLSerializer();
      const res: Record<string, string> = {};
      for (const ch of chars) {
        const found = await findSign(`han/${ch}`);
        const bundle = await loadSign(found.summary);
        res[ch] = ser.serializeToString(buildPicture(bundle.picture.tree));
      }
      return res;
    }, Object.keys(golden));
    for (const [ch, p] of Object.entries(golden)) assert.equal(out[ch], p.svg, ch);
  } finally {
    await browser.close();
    await dev.close();
  }
});
