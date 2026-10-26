// Cloudflare Pages limits (spec §6): fail above the file budget, on any file over the size cap, and on any
// Git LFS pointer that was never fetched (it would deploy a text stub instead of audio).
import { openSync, readSync, closeSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { isLfsPointer } from '../audio/pack.ts';

export interface BudgetReport { files: number; bytes: number; byDir: Record<string, number>; largest: { file: string; bytes: number }; problems: string[] }

function head(abs: string, n: number): Uint8Array {
  const buf = new Uint8Array(n);
  const fd = openSync(abs, 'r');
  try { return buf.subarray(0, readSync(fd, buf, 0, n, 0)); } finally { closeSync(fd); }
}

export function checkBudget(dir: string, budget: { maxFiles: number; maxFileMiB: number }): BudgetReport {
  const r: BudgetReport = { files: 0, bytes: 0, byDir: {}, largest: { file: '', bytes: 0 }, problems: [] };
  const cap = budget.maxFileMiB * 1024 * 1024;
  const walk = (abs: string) => {
    for (const name of readdirSync(abs).sort()) {
      const p = path.join(abs, name);
      const st = statSync(p);
      if (st.isDirectory()) { walk(p); continue; }
      const rel = path.relative(dir, p).split(path.sep).join('/');
      const top = rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '.';
      r.files++;
      r.bytes += st.size;
      r.byDir[top] = (r.byDir[top] ?? 0) + 1;
      if (st.size > r.largest.bytes) r.largest = { file: rel, bytes: st.size };
      if (st.size > cap) r.problems.push(`${rel} is larger than ${budget.maxFileMiB} MiB (${(st.size / 1048576).toFixed(1)} MiB)`);
      if (st.size < 1024 && isLfsPointer(head(p, 200))) r.problems.push(`${rel} is a Git LFS pointer, not real content (run git lfs pull)`);
    }
  };
  walk(dir);
  if (r.files > budget.maxFiles) r.problems.unshift(`${r.files} files exceed the budget of ${budget.maxFiles}`);
  return r;
}

export function formatBudget(r: BudgetReport): string {
  const dirs = Object.entries(r.byDir).sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d}: ${n}`).join(', ');
  return `budget: ${r.files} files, ${(r.bytes / 1048576).toFixed(1)} MiB (${dirs}); largest ${r.largest.file} ${(r.largest.bytes / 1048576).toFixed(2)} MiB`;
}
