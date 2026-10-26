// npm run ingest:photos [-- heji6057 …] [--refresh] [--dry-run] — download artifact photos named by each artifact's
// `image: { file, commons }` and write its `credit:` section (author, licence, page, size). The job list comes from
// content/artifacts/*.yaml; scripts/commons_photos.py checks the licence allowlist, downloads and re-encodes the image.
// Without ids it handles the artifacts whose photo or credit is missing; --refresh downloads again.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CONTENT_DIR, rel } from '../paths.ts';
import { writeCredit } from '../content/credit-writer.ts';
import { Diags } from '../content/diagnostics.ts';
import { loadContent, type ArtifactDoc, type ContentSet } from '../content/load.ts';
import { makeSchemas } from '../content/schema.ts';
import { runAdapter } from './python.ts';

export interface PhotoJob { id: string; title: string; file: string; refresh: boolean }
export interface PhotoResult { id: string; error?: string; author?: string; license?: string; page?: string; width?: number; height?: number }

export function selectArtifacts(content: ContentSet, ids: string[], refresh: boolean): ArtifactDoc[] {
  if (ids.length) {
    return ids.map((id) => {
      const a = content.artifacts.get(id);
      if (!a) throw new Error(`unknown artifact ${id}`);
      return a;
    });
  }
  return [...content.artifacts.values()].filter((a) => refresh || !existsSync(a.photoAbs) || !a.data.credit);
}

export const photoJobs = (artifacts: ArtifactDoc[], refresh: boolean): PhotoJob[] =>
  artifacts.map((a) => ({ id: a.data.id, title: a.data.image.commons, file: a.data.image.file, refresh }));

/** Write each artifact's credit from the adapter's results (validated against the schema); returns problems. */
export function applyPhotoResults(content: ContentSet, results: PhotoResult[]): string[] {
  const credit = makeSchemas(content.locales).Artifact.shape.credit.unwrap();
  const problems: string[] = [];
  for (const r of results) {
    const a = content.artifacts.get(r.id);
    if (!a) { problems.push(`${r.id}: not an artifact`); continue; }
    if (r.error) { problems.push(`${r.id}: ${r.error}`); continue; }
    const parsed = credit.safeParse({ author: r.author, license: r.license, page: r.page, width: r.width, height: r.height });
    if (!parsed.success) { problems.push(`${r.id}: credit rejected (${parsed.error.issues[0]?.message})`); continue; }
    writeFileSync(a.y.abs, writeCredit(readFileSync(a.y.abs, 'utf8'), parsed.data));
  }
  return problems;
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { refresh: { type: 'boolean', default: false }, 'dry-run': { type: 'boolean', default: false }, content: { type: 'string' } },
  });
  const diags = new Diags();
  const content = loadContent(path.resolve(values.content ?? CONTENT_DIR), diags);
  if (!content) {
    for (const line of diags.lines()) console.log(line);
    process.exit(1);
  }
  const refresh = values.refresh ?? false;
  const jobs = photoJobs(selectArtifacts(content, positionals, refresh), refresh);
  if (!jobs.length) {
    console.log('ingest:photos: every artifact has its photo and credit (name artifacts or pass --refresh)');
    return;
  }
  if (values['dry-run']) {
    for (const j of jobs) console.log(`${j.id}  ${j.title} → ${rel(path.join(content.root, 'artifacts', j.file))}`);
    return;
  }
  const { results } = runAdapter<{ results: PhotoResult[] }>('commons_photos.py', { dir: path.join(content.root, 'artifacts'), jobs });
  const problems = applyPhotoResults(content, results);
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log(`ingest:photos: ${results.length - problems.length} credit(s) written, ${problems.length} problem(s); now run npm run check`);
  if (problems.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
