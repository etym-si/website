// Temporary content directories for loader/validator tests (copied from a fixture, then patched).
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEMOS, TMP_DIR } from '../../tools/paths.ts';
import { Diags } from '../../tools/content/diagnostics.ts';
import { loadContent, type ContentSet } from '../../tools/content/load.ts';
import { validateContent } from '../../tools/content/validate.ts';

export const EGYPT_FIXTURE = path.join(DEMOS, 'tests', 'fixtures', 'content-egyptian');

export function fixtureCopy(files: Record<string, string> = {}, from = EGYPT_FIXTURE): string {
  mkdirSync(TMP_DIR, { recursive: true });
  const dir = mkdtempSync(path.join(TMP_DIR, 'content-'));
  cpSync(from, dir, { recursive: true });
  for (const [relPath, text] of Object.entries(files)) {
    const abs = path.join(dir, relPath);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  return dir;
}

export function loadFixture(dir: string, strict = false): { content: ContentSet | null; diags: Diags } {
  const diags = new Diags();
  const content = loadContent(dir, diags);
  if (content) validateContent(content, diags, { strict });
  return { content, diags };
}
