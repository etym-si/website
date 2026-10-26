// node tools/check-dist.ts [distDir] [--content DIR] — the last step of npm run build: file budget + LFS pointers.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parse } from 'yaml';
import { CONTENT_DIR, DEMOS } from './paths.ts';
import { checkBudget, formatBudget } from './compile/budget.ts';
import { ConfigSchema } from './content/schema.ts';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { content: { type: 'string' } } });
const config = ConfigSchema.parse(parse(readFileSync(path.join(path.resolve(values.content ?? CONTENT_DIR), 'config.yaml'), 'utf8')));
const report = checkBudget(path.resolve(positionals[0] ?? path.join(DEMOS, 'dist')), config.budget);
console.log(formatBudget(report));
for (const p of report.problems) console.log(`  ✖ ${p}`);
process.exitCode = report.problems.length ? 1 : 0;
