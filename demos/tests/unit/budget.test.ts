import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { checkBudget } from '../../tools/compile/budget.ts';
import { TMP_DIR } from '../../tools/paths.ts';

function dist(files: Record<string, string | Uint8Array>): string {
  mkdirSync(TMP_DIR, { recursive: true });
  const dir = mkdtempSync(path.join(TMP_DIR, 'dist-'));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

test('a small site passes and is broken down by top-level folder', () => {
  const r = checkBudget(dist({ 'index.html': 'x', 'assets/a.js': 'x', 'data/signs/han/a.json': 'x' }), { maxFiles: 18000, maxFileMiB: 24 });
  assert.deepEqual(r.problems, []);
  assert.equal(r.files, 3);
  assert.deepEqual(r.byDir, { '.': 1, assets: 1, data: 1 });
});

test('too many files, oversized files and LFS pointers fail the build', () => {
  const r = checkBudget(dist({
    'a.txt': 'x', 'b.txt': 'x', 'c.txt': 'x',
    'data/big.mp3': new Uint8Array(1024 * 1024 + 1),
    'data/clip.mp3': 'version https://git-lfs.github.com/spec/v1\noid sha256:00\nsize 1\n',
  }), { maxFiles: 4, maxFileMiB: 1 });
  assert.ok(r.problems.some((p) => p.includes('5 files exceed the budget of 4')), r.problems.join('\n'));
  assert.ok(r.problems.some((p) => p.includes('data/big.mp3 is larger than 1 MiB')), r.problems.join('\n'));
  assert.ok(r.problems.some((p) => p.includes('data/clip.mp3 is a Git LFS pointer')), r.problems.join('\n'));
});
