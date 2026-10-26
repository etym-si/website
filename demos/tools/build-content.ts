// npm run content — validate content/, compile it, and write public/data, public/_headers, public/CREDITS.md,
// public/licenses and src/generated. No network, no secrets. --strict turns warnings (translations, audio) into errors.
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONTENT_DIR, GENERATED_DIR, MEDIA_DIR, PUBLIC_DIR } from './paths.ts';
import { Diags } from './content/diagnostics.ts';
import { loadContent } from './content/load.ts';
import { validateContent } from './content/validate.ts';
import { writeSite } from './compile/output.ts';
import { compileSite } from './compile/site.ts';

const { values } = parseArgs({
  options: {
    strict: { type: 'boolean', default: false }, content: { type: 'string' }, media: { type: 'string' },
    public: { type: 'string' }, generated: { type: 'string' },
  },
});
const strict = values.strict ?? false;
const diags = new Diags();
const content = loadContent(path.resolve(values.content ?? CONTENT_DIR), diags);
if (content) validateContent(content, diags, { strict });
const site = content && !diags.errors.length ? compileSite(content, { mediaDir: path.resolve(values.media ?? MEDIA_DIR), strict }, diags) : null;
for (const line of diags.lines()) console.log(line);
if (!site || diags.errors.length) {
  console.log(`content: ${diags.errors.length} error(s), ${diags.warnings.length} warning(s); nothing written`);
  process.exit(1);
}
writeSite(site, { publicDir: path.resolve(values.public ?? PUBLIC_DIR), generatedDir: path.resolve(values.generated ?? GENERATED_DIR) });
const s = site.stats;
console.log(`content: ${s.signs} signs, ${s.stories} stories, ${s.collections} collections, ${s.photos} photos, ${s.clips} clip slots; ${site.files.size} files, ${(s.bytes / 1048576).toFixed(1)} MiB; ${diags.warnings.length} warning(s)`);
