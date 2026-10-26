// npm run check [-- --strict] [--content DIR] — validate content without writing anything.
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONTENT_DIR } from './paths.ts';
import { Diags } from './content/diagnostics.ts';
import { loadContent } from './content/load.ts';
import { validateContent } from './content/validate.ts';
import { checkStory } from './compile/stories.ts';

const { values } = parseArgs({ options: { strict: { type: 'boolean', default: false }, content: { type: 'string' } } });
const diags = new Diags();
const content = loadContent(path.resolve(values.content ?? CONTENT_DIR), diags);
if (content) {
  validateContent(content, diags, { strict: values.strict ?? false });
  for (const coll of content.collections.values()) for (const story of coll.stories.values()) checkStory(content, coll, story, diags);
}
for (const line of diags.lines()) console.log(line);
console.log(`check: ${diags.errors.length} error(s), ${diags.warnings.length} warning(s)`);
process.exitCode = diags.errors.length ? 1 : 0;
