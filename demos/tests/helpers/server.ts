// Servers for browser tests: always 127.0.0.1, always a free port.
import { spawnSync } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import type { Page } from 'playwright';
import { createServer, preview } from 'vite';
import { DEMOS } from '../../tools/paths.ts';

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = netServer();
    srv.listen(0, '127.0.0.1', () => {
      const a = srv.address();
      srv.close(() => (a && typeof a === 'object' ? resolve(a.port) : reject(new Error('no free port'))));
    });
  });
}

/** Vite dev server with the project config (aliases, public dir). */
export async function startDev(): Promise<{ url: string; close: () => Promise<void> }> {
  const port = await freePort();
  const server = await createServer({ root: DEMOS, logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null } });
  await server.listen();
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}

/** Vite preview of a production build (real CSP and security headers, Range support). */
export async function startPreview(outDir: string): Promise<{ url: string; close: () => Promise<void> }> {
  const port = await freePort();
  const server = await preview({ root: DEMOS, logLevel: 'error', build: { outDir }, preview: { host: '127.0.0.1', port, strictPort: true } });
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}

export function runNode(args: string[], env: Record<string, string> = {}): void {
  const r = spawnSync(process.execPath, args, { cwd: DEMOS, env: { ...process.env, ...env }, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`node ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
}

/** Collect console errors, page errors, CSP violations and every .mp3 response status. */
export async function watchPage(page: Page): Promise<{ problems: string[]; mp3: { url: string; status: number }[] }> {
  const w = { problems: [] as string[], mp3: [] as { url: string; status: number }[] };
  page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/.test(m.text())) w.problems.push(`[console:${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => w.problems.push(`[pageerror] ${e.message}`));
  page.on('response', (r) => { if (r.url().endsWith('.mp3')) w.mp3.push({ url: r.url(), status: r.status() }); });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`));
  });
  return w;
}
