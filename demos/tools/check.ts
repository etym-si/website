// npm run check [-- --strict] [--content DIR] [--media DIR] — validate and compile in memory; writes nothing.
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONTENT_DIR, MEDIA_DIR } from './paths.ts';
import { Diags } from './content/diagnostics.ts';
import { loadContent } from './content/load.ts';
import { validateContent } from './content/validate.ts';
import { compileSite } from './compile/site.ts';

const { values } = parseArgs({ options: { strict: { type: 'boolean', default: false }, content: { type: 'string' }, media: { type: 'string' } } });
const strict = values.strict ?? false;
const diags = new Diags();
const content = loadContent(path.resolve(values.content ?? CONTENT_DIR), diags);
if (content) {
  validateContent(content, diags, { strict });
  if (!diags.errors.length) compileSite(content, { mediaDir: path.resolve(values.media ?? MEDIA_DIR), strict }, diags);
}
for (const line of diags.lines()) console.log(line);
console.log(`check: ${diags.errors.length} error(s), ${diags.warnings.length} warning(s)`);
process.exitCode = diags.errors.length ? 1 : 0;
