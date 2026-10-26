// Runs a Python network adapter on a job list. Node decides what to fetch or record (from content); the adapters in
// scripts/ only talk to their allowlisted hosts. Jobs and results pass through a private temp directory.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEMOS } from '../paths.ts';

/** `python3 scripts/<script> <jobs.json> <results.json>`; returns the parsed results file. */
export function runAdapter<T>(script: string, payload: unknown): T {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'etym-ingest-'));
  try {
    const jobs = path.join(dir, 'jobs.json');
    const results = path.join(dir, 'results.json');
    writeFileSync(jobs, JSON.stringify(payload));
    const r = spawnSync('python3', [path.join(DEMOS, 'scripts', script), jobs, results], { stdio: 'inherit' });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`scripts/${script} exited with status ${r.status}`);
    return JSON.parse(readFileSync(results, 'utf8')) as T;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
