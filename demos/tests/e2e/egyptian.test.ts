// Spec §10: a one-sign Egyptian system compiles and plays in the Theater — the pipeline is not tied to Chinese.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { CONTENT_DIR, DEMOS, TMP_DIR } from '../../tools/paths.ts';
import { launchChromium } from '../helpers/browser.ts';
import { EGYPT_FIXTURE } from '../helpers/fixture.ts';
import { startTheater } from '../helpers/player.ts';
import { runNode, startPreview, watchPage } from '../helpers/server.ts';

test('the Egyptian fixture builds and plays in the Theater', async () => {
  mkdirSync(TMP_DIR, { recursive: true });
  const tmp = mkdtempSync(path.join(TMP_DIR, 'egypt-'));
  const content = path.join(tmp, 'content');
  cpSync(EGYPT_FIXTURE, content, { recursive: true });
  copyFileSync(path.join(CONTENT_DIR, 'ui.yaml'), path.join(content, 'ui.yaml')); // the app needs every UI string
  const dirs = { public: path.join(tmp, 'public'), generated: path.join(tmp, 'generated'), dist: path.join(tmp, 'dist') };
  runNode(['tools/build-content.ts', '--content', content, '--public', dirs.public, '--generated', dirs.generated]);
  runNode([path.join(DEMOS, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--logLevel', 'error'],
    { ETYM_PUBLIC_DIR: dirs.public, ETYM_GENERATED_DIR: dirs.generated, ETYM_OUT_DIR: dirs.dist });
  const server = await startPreview(dirs.dist);
  const browser = await launchChromium();
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const w = await watchPage(page);
    await page.goto(`${server.url}#/theater/egyptian/G17`);
    await startTheater(page);
    await page.locator('.tl-station[data-stage="demotic"].current').waitFor({ timeout: 30000 });
    assert.ok((await page.locator('.stage-box .glyph.hist path.g-fill').count()) > 0, 'a hieroglyph form was drawn');
    assert.equal(await page.locator('.info-char').textContent(), '𓅓');
    assert.deepEqual(w.problems, []);
  } finally {
    await browser.close();
    await server.close();
  }
});
