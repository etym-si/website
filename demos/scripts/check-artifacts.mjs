// Dev check: walk a character through the theater, capturing the artifact card at each stage + one dialog.
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chars = [...(process.argv[2] || '田')];
const PORT = 3639;
const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((r) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && r()));
const browser = await launch();
const errors = [];
try {
  for (const ch of chars) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.on('console', (m) => (m.type() === 'error' || /Content Security Policy/.test(m.text())) && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/#/theater/${encodeURIComponent(ch)}`);
    await page.click('.start-overlay');
    await page.click('.controls .seg .chip:nth-child(3)'); // 2× speed
    const seenStages = new Set();
    let dialogShot = false;
    for (let t = 0; t < 120 && seenStages.size < 6; t++) {
      await page.waitForTimeout(500);
      const st = await page.locator('.tl-station.current').getAttribute('data-stage').catch(() => null);
      if (!st || seenStages.has(st)) continue;
      seenStages.add(st);
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(root, 'shots', `art-${ch}-${st}.png`) });
      console.log(ch, st, await page.locator('.artifact-card:not(.hidden) .a-title').textContent().catch(() => '(no card)'));
      if (!dialogShot && (await page.locator('.artifact-card:not(.hidden) .a-exact').count())) {
        await page.locator('.artifact-card').click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: join(root, 'shots', `art-${ch}-dialog.png`) });
        await page.keyboard.press('Escape');
        dialogShot = true;
      }
    }
    await page.waitForTimeout(2500);
    await page.locator('.a-list').scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: join(root, 'shots', `art-${ch}-list.png`) });
    await page.close();
  }
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
process.exit();
