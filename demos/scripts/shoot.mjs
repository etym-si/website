// Dev tool: drive the built demo in headless Chromium, capture screenshots across animation timelines,
// and fail on console errors or CSP violations. Serves dist/ on 127.0.0.1 only.
// Usage: node scripts/shoot.mjs [home|theater|story|learn|lesson|book|all] [char]
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3637;
const BASE = `http://127.0.0.1:${PORT}/`;
const which = process.argv[2] || 'all';
const charArg = process.argv[3] || '马';
mkdirSync(join(root, 'shots'), { recursive: true });

const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview did not start')), 15000);
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); resolve(); } });
  server.stderr.on('data', (d) => process.stderr.write(d));
});

const browser = await launch();
const problems = [];
async function newPage(viewport = { width: 1366, height: 900 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/.test(m.text())) problems.push(`[console:${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`));
  });
  return page;
}
const shot = (page, name) => page.screenshot({ path: join(root, 'shots', `${name}.png`) }).then(() => console.log('  shot', name));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function home() {
  const page = await newPage();
  await page.goto(BASE + '#/');
  await sleep(2500); await shot(page, 'home-1');
  await sleep(3500); await shot(page, 'home-2');
  await page.context().close();
}

async function theater(ch = charArg) {
  const page = await newPage();
  await page.goto(BASE + `#/theater/${encodeURIComponent(ch)}`);
  await page.click('.start-overlay');
  const times = [1200, 3500, 6500, 9000, 12000, 15000, 19000, 24000, 30000];
  let last = 0;
  for (const [i, t] of times.entries()) { await sleep(t - last); last = t; await shot(page, `theater-${ch}-${i}`); }
  await page.context().close();
}

async function story(n = 1) {
  const page = await newPage();
  await page.goto(BASE + `#/story/${n}`);
  await page.click('.start-overlay');
  const times = [3000, 8000, 14000, 20000, 27000, 34000, 42000, 50000, 60000];
  let last = 0;
  for (const [i, t] of times.entries()) { await sleep(t - last); last = t; await shot(page, `story${n}-${i}`); }
  await page.context().close();
}

async function learn() {
  const page = await newPage();
  await page.goto(BASE + '#/learn');
  await sleep(800); await shot(page, 'learn');
  await page.goto(BASE + '#/book');
  await sleep(1200); await shot(page, 'book');
  await page.context().close();
}

/** Play through lesson u1-l1 answering correctly (and tracing 日 with the mouse). */
async function lesson() {
  const page = await newPage({ width: 1180, height: 860 });
  await page.goto(BASE + '#/lesson/u1-l1');
  const cont = async () => { await page.locator('.lesson-footer button:not([disabled])').click({ timeout: 30000 }); await sleep(400); };
  const clickChoice = async (ch) => { await page.locator('.choice', { hasText: ch }).click(); await sleep(500); };
  const prompt = async () => (await page.locator('.prompt').first().textContent()) ?? '';
  for (let step = 0; step < 14; step++) {
    await sleep(700);
    if (await page.locator('.results').count()) { await sleep(1500); await shot(page, 'lesson-results'); break; }
    const p = await prompt();
    await shot(page, `lesson-${step}`);
    if (await page.locator('.meet-card').count()) {
      await sleep(5500); await shot(page, `lesson-${step}-meet-mid`);
      await page.locator('.meet-card.show').waitFor({ timeout: 40000 });
      await shot(page, `lesson-${step}-meet-end`);
      await cont();
    } else if (await page.locator('.order').count()) {
      await page.locator('.order-card').first().waitFor();
      for (let k = 0; k < 4; k++) {
        const card = page.locator(`.order-pool .order-card[data-i="${k}"]`);
        if (await card.count()) await card.click();
        await sleep(150);
      }
      await sleep(400); await shot(page, `lesson-${step}-answered`); await cont();
    } else if (await page.locator('.match').count()) {
      await sleep(600);
      const cs = await page.locator('.match-card.modern').evaluateAll((els) => els.map((e) => e.dataset.c));
      for (const c of cs) {
        await page.locator(`.match-card.ancient[data-c="${c}"]`).click();
        await page.locator(`.match-card.modern[data-c="${c}"]`).click();
        await sleep(300);
      }
      await sleep(600); await shot(page, `lesson-${step}-answered`); await cont();
    } else if (await page.locator('.trace-box').count()) {
      await sleep(800);
      const box = await page.locator('.trace-box svg').boundingBox();
      const data = JSON.parse(readFileSync(join(root, 'public', 'hanzi', '日.json'), 'utf8'));
      const scale = (260 - 28) / 1024;
      const toScreen = ([x, y]) => [box.x + 14 + x * scale, box.y + 260 - (124 * scale + 14) - y * scale];
      for (const med of data.medians) {
        const pts = med.map(toScreen);
        await page.mouse.move(pts[0][0], pts[0][1]);
        await page.mouse.down();
        for (const p2 of pts.slice(1)) await page.mouse.move(p2[0], p2[1], { steps: 6 });
        await page.mouse.up();
        await sleep(350);
      }
      await sleep(300); await shot(page, `lesson-${step}-traced`);
      await cont();
    } else {
      // picture / ancient / listen → answer from the aria-label of the target the page expects
      const target = await page.locator('.choices').getAttribute('data-answer');
      const choices = await page.locator('.choice').evaluateAll((els) => els.map((e) => e.textContent));
      const pick = target ?? choices[0];
      await clickChoice(pick); await shot(page, `lesson-${step}-answered`); await cont();
    }
    console.log('  step', step, p.slice(0, 50));
  }
  await page.context().close();
}

try {
  if (which === 'home' || which === 'all') await home();
  if (which === 'theater' || which === 'all') await theater();
  if (which === 'story' || which === 'all') { await story(1); if (which === 'story') await story(2); }
  if (which === 'story2') await story(2);
  if (which === 'learn' || which === 'all') await learn();
  if (which === 'lesson' || which === 'all') await lesson();
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
if (problems.length) {
  console.log('\nPROBLEMS:\n' + [...new Set(problems)].join('\n'));
  process.exitCode = 1;
} else console.log('\nno console errors / CSP violations');
process.exit();
