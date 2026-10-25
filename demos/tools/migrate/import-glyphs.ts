// Reusable CLI: legacy Commons glyph JSON (the format of the old demos/public/glyphs/<char>.json) → the `forms:`
// section of the matching sign files. Used for the film-36 migration and for staged batches such as
// staging/han-500/glyphs. Composite ids work: `后-後.json` updates `后-後.yaml`.
// Usage: node tools/migrate/import-glyphs.ts <dir> [--content DIR] [--system han] [--dry-run]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse } from 'yaml';
import { CONTENT_DIR } from '../paths.ts';
import { writeForms } from '../content/forms-writer.ts';
import type { Form } from '../content/schema.ts';

export interface LegacyPath { d: string; t?: string; mode?: 'stroke' | 'knockout'; w?: number; rule?: 'evenodd' }
export interface LegacyStage {
  stage: string; form: string; variant: string; src?: string;
  box: [number, number, number, number]; paths: LegacyPath[];
  prov?: { period?: string; code?: string; note?: string };
}
export interface LegacyGlyphDoc { char: string; trad: string; stages: LegacyStage[] }

export function commonsTitleFromUrl(src: string | undefined): string | undefined {
  const m = src ? /^https:\/\/commons\.wikimedia\.org\/wiki\/(.+)$/.exec(src) : null;
  return m ? decodeURIComponent(m[1]).replaceAll('_', ' ') : undefined;
}

export function isLegacyGlyphDoc(v: unknown): v is LegacyGlyphDoc {
  const o = v as LegacyGlyphDoc;
  return !!o && typeof o.char === 'string' && typeof o.trad === 'string' && Array.isArray(o.stages)
    && o.stages.every((s) => s && typeof s.stage === 'string' && typeof s.form === 'string' && typeof s.variant === 'string'
      && Array.isArray(s.box) && s.box.length === 4 && Array.isArray(s.paths) && s.paths.every((p) => p && typeof p.d === 'string'));
}

export function formsFromLegacy(doc: LegacyGlyphDoc): Form[] {
  return doc.stages.map((s) => {
    const commons = commonsTitleFromUrl(s.src);
    return {
      stage: s.stage, form: s.form, variant: s.variant,
      ...(commons ? { commons } : {}),
      provenance: { period: s.prov?.period ?? '', code: s.prov?.code ?? '', note: s.prov?.note ?? '' },
      box: s.box,
      paths: s.paths.map((p) => ({
        d: p.d, ...(p.t ? { t: p.t } : {}), ...(p.mode ? { mode: p.mode } : {}), ...(p.w !== undefined ? { w: p.w } : {}), ...(p.rule ? { rule: p.rule } : {}),
      })),
    };
  });
}

/** The sign file for a glyph doc: same stem first, else the single sign whose Hans/Hant texts match. */
export function findSignFile(signsDir: string, stem: string, doc: LegacyGlyphDoc): string | null {
  const direct = path.join(signsDir, `${stem}.yaml`);
  if (existsSync(direct)) return direct;
  const hits = readdirSync(signsDir).filter((f) => f.endsWith('.yaml')).filter((f) => {
    const text = (parse(readFileSync(path.join(signsDir, f), 'utf8')) as { text?: Record<string, string> } | null)?.text ?? {};
    return text.Hans === doc.char && (text.Hant ?? text.Hans) === doc.trad;
  });
  return hits.length === 1 ? path.join(signsDir, hits[0]) : null;
}

export interface ImportReport { written: string[]; unmatched: string[]; invalid: string[] }

export function importGlyphDir(opts: { dir: string; contentDir: string; system: string; dryRun?: boolean }): ImportReport {
  const signsDir = path.join(opts.contentDir, 'systems', opts.system, 'signs');
  const report: ImportReport = { written: [], unmatched: [], invalid: [] };
  for (const f of readdirSync(opts.dir).filter((x) => x.endsWith('.json') && x !== 'index.json').sort()) {
    let doc: unknown;
    try { doc = JSON.parse(readFileSync(path.join(opts.dir, f), 'utf8')); } catch { doc = null; }
    if (!isLegacyGlyphDoc(doc)) { report.invalid.push(f); continue; }
    const file = findSignFile(signsDir, f.replace(/\.json$/, ''), doc);
    if (!file) { report.unmatched.push(f); continue; }
    const next = writeForms(readFileSync(file, 'utf8'), formsFromLegacy(doc));
    if (!opts.dryRun) writeFileSync(file, next);
    report.written.push(path.basename(file));
  }
  return report;
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { content: { type: 'string' }, system: { type: 'string', default: 'han' }, 'dry-run': { type: 'boolean', default: false } },
  });
  if (positionals.length !== 1) {
    console.error('usage: node tools/migrate/import-glyphs.ts <dir> [--content DIR] [--system han] [--dry-run]');
    process.exit(2);
  }
  const dryRun = values['dry-run'] ?? false;
  const r = importGlyphDir({ dir: path.resolve(positionals[0]), contentDir: path.resolve(values.content ?? CONTENT_DIR), system: values.system ?? 'han', dryRun });
  console.log(`import-glyphs: ${r.written.length} sign file(s) updated${dryRun ? ' (dry run)' : ''}`);
  for (const f of r.unmatched) console.log(`  no sign file for ${f}`);
  for (const f of r.invalid) console.log(`  not a legacy glyph document: ${f}`);
  if (r.unmatched.length || r.invalid.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
