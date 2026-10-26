// npm run new -- <system> <id> — create content/systems/<system>/signs/<id>.yaml with every required field present and
// empty, ready to fill in (then `npm run ingest:glyphs -- <system>/<id>`, `npm run tts`, `npm run check`).
// The id is checked against the system's signId rule before it becomes a file name; existing files are never touched.
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { stringify } from 'yaml';
import { CONTENT_DIR, rel } from './paths.ts';
import { Diags, formatDiagnostic } from './content/diagnostics.ts';
import { loadContent } from './content/load.ts';
import type { System } from './content/schema.ts';

const FILE_SAFE = /^[^/\\\s.][^/\\\s]{0,31}$/;
const q = (s: string) => (s ? stringify(s).trimEnd() : "''");

/** Ids that are written forms (han: 马, 发-髮) prefill `text`; code ids (Egyptian G17) leave it empty. */
export function newSignYaml(sys: System, id: string, baseLocale: string): string {
  const parts = id.split('-');
  const written = !/^[\x20-\x7e]+$/.test(id);
  const text = sys.textScripts.map((s, i) => `${s}: ${q(written ? (parts[i] ?? parts[0]) : '')}`).join(', ');
  const readings = Object.keys(sys.readings).map((r) => `${r}: ''`).join(', ');
  return [
    '# yaml-language-server: $schema=../../../_schema/sign.schema.json',
    `id: ${q(id)}`,
    'status: draft',
    `text: { ${text} }`,
    `readings: { ${readings} }`,
    `meaning: { ${baseLocale}: '' }`,
    `fact: { ${baseLocale}: '' }`,
    `journey: ${sys.defaultJourney ? 'default' : '[]'}`,
    '',
  ].join('\n');
}

/** Path of the new sign file, or an error message. */
export function newSignFile(contentDir: string, sys: System, id: string): { file: string } | { error: string } {
  if (!FILE_SAFE.test(id) || !new RegExp(sys.signId, 'u').test(id)) return { error: `"${id}" is not a valid ${sys.id} sign id (rule: ${sys.signId})` };
  const file = path.join(contentDir, 'systems', sys.id, 'signs', `${id}.yaml`);
  if (existsSync(file)) return { error: `${rel(file)} already exists` };
  return { file };
}

function main(): void {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { content: { type: 'string' } } });
  if (positionals.length !== 2) {
    console.error('usage: npm run new -- <system> <id>   e.g. npm run new -- han 鹤');
    process.exit(2);
  }
  const [systemId, id] = positionals;
  const contentDir = path.resolve(values.content ?? CONTENT_DIR);
  const diags = new Diags();
  const content = loadContent(contentDir, diags);
  const sys = content?.systems.get(systemId);
  if (!content || !sys) {
    for (const d of diags.errors) console.error(formatDiagnostic(d));
    console.error(`new: unknown writing system "${systemId}"`);
    process.exit(1);
  }
  const target = newSignFile(contentDir, sys.data, id);
  if ('error' in target) {
    console.error(`new: ${target.error}`);
    process.exit(1);
  }
  writeFileSync(target.file, newSignYaml(sys.data, id, content.locales[0]), { flag: 'wx' });
  console.log(`new: created ${rel(target.file)}; fill it in, then run npm run ingest:glyphs -- ${systemId}/${id}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
