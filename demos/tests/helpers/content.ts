// The real content/ tree, loaded once per test process and required to be clean in strict mode.
import { Diags } from '../../tools/content/diagnostics.ts';
import { loadContent, type ContentSet } from '../../tools/content/load.ts';
import { validateContent } from '../../tools/content/validate.ts';
import { CONTENT_DIR } from '../../tools/paths.ts';

let cached: ContentSet | null = null;

export function realContent(): ContentSet {
  if (cached) return cached;
  const diags = new Diags();
  const content = loadContent(CONTENT_DIR, diags);
  if (content) validateContent(content, diags, { strict: true });
  if (!content || diags.errors.length) throw new Error(`content/ is not clean:\n${diags.lines().join('\n')}`);
  cached = content;
  return content;
}
