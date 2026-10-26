// npm run ingest:glyphs [-- han/鹤 …] [--all] [--dry-run] — fill the `forms:` section of sign files from the
// Wikimedia Commons "Ancient Chinese characters project" (public domain). The job list comes from content: each
// journey entry (the system's `defaultJourney` or the sign's own `journey:`) names a stage, the form to look up and
// the Commons variants to try in order (`File:<form>-<variant>.svg`). scripts/commons_glyphs.py downloads and reduces
// the SVGs; this tool validates the geometry with the content schema and rewrites only the `forms:` node.
// Without keys it ingests the signs that have no `forms:` section yet; --all refreshes every sign.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CONTENT_DIR, rel } from '../paths.ts';
import { Diags } from '../content/diagnostics.ts';
import { writeForms } from '../content/forms-writer.ts';
import { loadContent, type ContentSet, type SignDoc } from '../content/load.ts';
import { journeyEntries, signByKey } from '../content/lookup.ts';
import { makeSchemas, QUALIFIED_SIGN, type Form } from '../content/schema.ts';
import { runAdapter } from './python.ts';

export interface GlyphJob { id: string; candidates: { variant: string; title: string }[] }
export interface GlyphResult {
  id: string;
  error?: string;
  variant?: string;
  title?: string;
  provenance?: { period: string; code: string; note: string };
  box?: number[];
  paths?: unknown[];
}
export interface SignPlan { sign: SignDoc; entries: { stage: string; form: string; job: GlyphJob }[] }
type FormSchema = ReturnType<typeof makeSchemas>['Form'];

/** The given sign keys, or every sign of a commons-acc system (`all`), or those without a `forms:` section. */
export function selectSigns(content: ContentSet, keys: string[], all: boolean): SignDoc[] {
  if (keys.length) {
    return keys.map((k) => {
      const sign = QUALIFIED_SIGN.test(k) ? signByKey(content, k) : undefined;
      if (!sign) throw new Error(`unknown sign ${k} (use <system>/<id>, e.g. han/马)`);
      return sign;
    });
  }
  return [...content.systems.values()]
    .filter((sys) => sys.data.ingest.glyphs === 'commons-acc')
    .flatMap((sys) => [...sys.signs.values()])
    .filter((s) => all || !s.data.forms);
}

/** One job per journey entry: the Commons titles to try, in order. */
export function glyphPlan(content: ContentSet, signs: SignDoc[]): SignPlan[] {
  return signs.map((sign) => {
    const sys = content.systems.get(sign.system)!;
    if (sys.data.ingest.glyphs !== 'commons-acc') throw new Error(`${sign.key}: system ${sys.data.id} has no glyph ingest adapter`);
    return {
      sign,
      entries: journeyEntries(sys, sign).map((e, i) => ({
        stage: e.stage,
        form: e.form,
        job: { id: `${sign.key}#${i}`, candidates: e.variants.map((variant) => ({ variant, title: `File:${e.form}-${variant}.svg` })) },
      })),
    };
  });
}

/** Forms in journey order. Entries without a usable Commons file are reported and left out. */
export function formsFromResults(plan: SignPlan, results: Map<string, GlyphResult>, schema: FormSchema): { forms: Form[]; problems: string[] } {
  const forms: Form[] = [];
  const problems: string[] = [];
  for (const e of plan.entries) {
    const r = results.get(e.job.id);
    if (!r || r.error) {
      problems.push(`${e.stage} ${e.form}: ${r?.error ?? 'no result'} (tried ${e.job.candidates.map((c) => c.title).join(', ')})`);
      continue;
    }
    const parsed = schema.safeParse({ stage: e.stage, form: e.form, variant: r.variant, commons: r.title, provenance: r.provenance, box: r.box, paths: r.paths });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      problems.push(`${e.stage} ${e.form}: ${r.title} rejected (${issue?.path.join('.')}: ${issue?.message})`);
      continue;
    }
    forms.push(parsed.data);
  }
  return { forms, problems };
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { all: { type: 'boolean', default: false }, 'dry-run': { type: 'boolean', default: false }, content: { type: 'string' } },
  });
  const diags = new Diags();
  const content = loadContent(path.resolve(values.content ?? CONTENT_DIR), diags);
  if (!content) {
    for (const line of diags.lines()) console.log(line);
    process.exit(1);
  }
  const plans = glyphPlan(content, selectSigns(content, positionals, values.all ?? false));
  if (!plans.length) {
    console.log('ingest:glyphs: every sign already has a forms section (name signs, e.g. han/马, or pass --all)');
    return;
  }
  const jobs = plans.flatMap((p) => p.entries.map((e) => e.job));
  if (values['dry-run']) {
    for (const j of jobs) console.log(`${j.id}  ${j.candidates.map((c) => c.title).join(' | ')}`);
    return;
  }
  const { results } = runAdapter<{ results: GlyphResult[] }>('commons_glyphs.py', { jobs });
  const byId = new Map(results.map((r) => [r.id, r]));
  const { Form } = makeSchemas(content.locales);
  let incomplete = 0;
  for (const plan of plans) {
    const { forms, problems } = formsFromResults(plan, byId, Form);
    const file = plan.sign.y.abs;
    writeFileSync(file, writeForms(readFileSync(file, 'utf8'), forms));
    console.log(`${plan.sign.key}: ${forms.map((f) => `${f.stage}/${f.variant}`).join(', ') || 'no forms'} → ${rel(file)}`);
    for (const p of problems) console.log(`  ✗ ${p}`);
    if (problems.length) incomplete++;
  }
  console.log(`ingest:glyphs: ${plans.length} sign file(s) written, ${incomplete} with missing forms; now run npm run check`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
