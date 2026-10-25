// Headless Chromium for tests and tools. Playwright's bundled browser is not installed on the dev machine,
// so prefer CHROMIUM_PATH, then the locally downloaded build, then Playwright's default (CI).
import { existsSync } from 'node:fs';
import { chromium, type Browser } from 'playwright';

const LOCAL_CHROME = '/home/kevin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';

export function chromiumPath(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  return existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined;
}

export function launchChromium(args: string[] = []): Promise<Browser> {
  return chromium.launch({ executablePath: chromiumPath(), args });
}
