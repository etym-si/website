// Dev helper: launch Playwright's Chromium, falling back to an already-downloaded build
// in ~/.cache/ms-playwright when the exact revision for this Playwright version is absent.
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export async function launch() {
  try {
    return await chromium.launch();
  } catch (err) {
    const cache = join(homedir(), '.cache', 'ms-playwright');
    const builds = existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium_headless_shell-\d+$/.test(d)).sort().reverse() : [];
    for (const b of builds) {
      const exe = join(cache, b, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
      if (existsSync(exe)) return chromium.launch({ executablePath: exe });
    }
    throw err;
  }
}
