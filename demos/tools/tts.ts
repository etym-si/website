// npm run tts [-- --dry-run] — record only the lines that have no master clip yet (spec §5): the compiler's list of
// missing clips (narration per audio section, pronunciations), already normalized per voice and keyed. scripts/tts.py
// synthesizes them into media/clips/<key>.mp3 (Git LFS); every new clip is frame-checked, then added to
// media/manifest.json. A line is never recorded twice. Network: the edge-tts endpoint only.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CONTENT_DIR, MEDIA_DIR, rel } from './paths.ts';
import { clipMs, clipPath, readMediaManifest, writeMediaManifest } from './audio/media.ts';
import { checkFrames } from './audio/pack.ts';
import { compileSite } from './compile/site.ts';
import { Diags, formatDiagnostic } from './content/diagnostics.ts';
import { loadContent, type ContentSet } from './content/load.ts';
import { validateContent } from './content/validate.ts';
import { runAdapter } from './ingest/python.ts';

export interface TtsJob { key: string; provider: string; voice: string; rate: string; text: string }

/** Every clip the published content needs and media/ does not have, sorted by key. */
export function ttsJobs(content: ContentSet, mediaDir: string, diags: Diags): TtsJob[] {
  const site = compileSite(content, { mediaDir, strict: false }, diags);
  return [...site.missing]
    .map(([key, m]) => ({ key, provider: m.provider, voice: m.voice, rate: m.rate, text: m.spoken }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** Frame-check the synthesized clips and add them to media/manifest.json; bad files are deleted. */
export function recordClips(mediaDir: string, jobs: TtsJob[]): { added: string[]; failed: string[] } {
  const manifest = readMediaManifest(mediaDir);
  const added: string[] = [];
  const failed: string[] = [];
  for (const j of jobs) {
    const file = clipPath(mediaDir, j.key);
    if (!existsSync(file)) { failed.push(j.key); continue; }
    const bytes = readFileSync(file);
    try {
      checkFrames(bytes, rel(file));
    } catch (e) {
      console.error(`  ✗ ${(e as Error).message}`);
      rmSync(file);
      failed.push(j.key);
      continue;
    }
    manifest.clips[j.key] = { provider: j.provider, voice: j.voice, rate: j.rate, text: j.text, bytes: bytes.length, ms: clipMs(bytes.length) };
    added.push(j.key);
  }
  writeMediaManifest(mediaDir, manifest);
  return { added, failed };
}

function main(): void {
  const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, content: { type: 'string' }, media: { type: 'string' } } });
  const mediaDir = path.resolve(values.media ?? MEDIA_DIR);
  const diags = new Diags();
  const stop = () => {
    for (const d of diags.errors) console.log(formatDiagnostic(d));
    console.log('tts: fix these errors first (npm run check)');
    process.exit(1);
  };
  const content = loadContent(path.resolve(values.content ?? CONTENT_DIR), diags);
  if (!content) return stop();
  validateContent(content, diags, { strict: false });
  if (diags.errors.length) return stop();
  const jobs = ttsJobs(content, mediaDir, diags);
  if (diags.errors.length) return stop();
  if (!jobs.length) {
    console.log(values['dry-run'] ? 'tts: 0 missing clip(s) (--dry-run)' : 'tts: every line already has a clip');
    return;
  }
  const chars = jobs.reduce((n, j) => n + j.text.length, 0);
  console.log(`tts: ${jobs.length} new clip(s), ${chars} characters`);
  if (values['dry-run']) {
    for (const j of jobs) console.log(`${j.key.slice(0, 12)} ${j.voice} ${j.rate} ${j.text}`);
    return;
  }
  let crash: Error | undefined;
  try {
    runAdapter<{ ok: string[]; failed: string[] }>('tts.py', { clipsDir: path.join(mediaDir, 'clips'), jobs });
  } catch (e) {
    crash = e as Error;
  }
  const { added, failed } = recordClips(mediaDir, jobs); // also keeps the clips recorded before a crash
  console.log(`tts: ${added.length} clip(s) added to ${rel(path.join(mediaDir, 'manifest.json'))}, ${failed.length} missing or rejected`);
  if (crash) console.error(`tts: ${crash.message}`);
  if (crash || failed.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
