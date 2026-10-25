// ONE-OFF migration of the film corpus (spec §12 phase 3). Inputs: tests/golden/*.json (Task 1), the legacy glyph
// JSON, photos and narration clips. Outputs: content/ (ui, 36 signs, collection, 6 stories, photos) and media/.
// The hand-written system/source/artifact YAML must exist first. Deleted in Task 11 together with its inputs.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, isMap, isScalar, isSeq, parse, Scalar, visit } from 'yaml';
import { CONTENT_DIR, DEMOS, GOLDEN_DIR, MEDIA_DIR } from '../paths.ts';
import { clipKey, legacyClipName, spokenText, type Voice } from '../audio/clip-key.ts';
import { clipMs, clipPath, writeMediaManifest, type MediaManifest } from '../audio/media.ts';
import { writeForms } from '../content/forms-writer.ts';
import { ConfigSchema, type Config } from '../content/schema.ts';
import { parseSvg, wrapPicture } from '../content/svg.ts';
import { formsFromLegacy, type LegacyGlyphDoc } from './import-glyphs.ts';

type Tri = { en: string; zhs: string; zht: string };
type LegacyStep = Record<string, unknown> & { do: string };
interface LegacyChar { char: string; trad: string; pinyin: string; meaning: Tri; fact: Tri }
interface LegacyStory { topic: Tri; hook: Tri; rotate?: Tri; early?: Tri; turn?: Tri; closer: Tri }
interface LegacyPicture { rotate: number; ambient: string | null; svg: string }
interface LegacyChapter { unit: number; title: Tri; topic: Tri; script: LegacyStep[] }
interface LegacyUnit { n: number; title: Tri; chars: string[]; color: string; playable: boolean }

export const tri = (t: Tri) => ({ en: t.en, 'zh-Hans': t.zhs, 'zh-Hant': t.zht });
const isTri = (v: unknown): v is Tri => !!v && typeof v === 'object' && 'zhs' in v;
const golden = <T>(name: string): T => JSON.parse(readFileSync(path.join(GOLDEN_DIR, `${name}.json`), 'utf8')) as T;
const LEGACY = {
  glyphs: path.join(DEMOS, 'public', 'glyphs'), photos: path.join(DEMOS, 'public', 'artifacts'),
  clips: path.join(DEMOS, 'public', 'tts'), ttsManifest: path.join(DEMOS, 'src', 'data', 'tts-manifest.json'),
};
/** In public/tts but referenced by no manifest entry; its text is unknown, so it cannot be keyed. */
export const KNOWN_ORPHANS = ['en-edb5022de1af.mp3'];
const FEATURED = ['日', '马', '山', '鸟', '象', '木']; // the home-page teaser list in src/screens/home.ts
const DEFAULT_JOURNEY = ['oracle', 'bronze', 'seal', 'clerical'];
/** fetch-glyphs.py OVERRIDES whose Commons variant lists differ from the stage defaults. */
const LEGACY_VARIANTS: Record<string, Record<string, string[]>> = { 网: { clerical: ['clerical', 'slip', 'silk'] }, 花: { bronze: ['bronze'] } };
const LOCALES = new Set(['en', 'zh-Hans', 'zh-Hant']);

/** Short scalar maps (and the listed sequences) in flow style; long texts stay in block style. */
function stylize(doc: Document, flowSeqKeys: string[]): void {
  visit(doc, {
    Map(_, map) {
      const keys = map.items.map((p) => (isScalar(p.key) ? String(p.key.value) : ''));
      const values = map.items.map((p) => p.value);
      const short = values.every((v) => isScalar(v) && String(v.value).length <= 48);
      if (short && (keys.every((k) => LOCALES.has(k)) || keys.length <= 6)) map.flow = true;
    },
    Pair(_, pair) {
      if (isSeq(pair.value) && isScalar(pair.key) && flowSeqKeys.includes(String(pair.key.value))) pair.value.flow = true;
    },
  });
}

/** Story steps: one line per step unless it carries a narration text. */
function stylizeStory(doc: Document): void {
  visit(doc, {
    Map(_, map) {
      const get = (k: string) => map.items.find((p) => isScalar(p.key) && p.key.value === k)?.value;
      const hasText = map.items.some((p) => isMap(p.value) && p.value.items.some((q) => isScalar(q.key) && LOCALES.has(String(q.key.value))));
      const isStep = get('do') !== undefined && (get('do') as Scalar).value !== 'together';
      const isTagSay = map.items.some((p) => isScalar(p.key) && p.key.value === 'tagSay');
      if (isStep && !hasText) map.flow = true;
      if (isTagSay) for (const p of map.items) if (isMap(p.value)) p.value.flow = true;
    },
    Pair(_, pair) {
      if (isSeq(pair.value) && isScalar(pair.key) && pair.key.value === 'cast') pair.value.flow = true;
    },
  });
}

const dump = (doc: Document, schema: string) => `# yaml-language-server: $schema=${schema}\n${doc.toString({ lineWidth: 0 })}`;
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function pictureSvg(markup: string): string {
  const g = parseSvg(markup);
  delete g[1].xmlns;
  return wrapPicture([g]);
}

export function journeyFor(ch: string, glyph: LegacyGlyphDoc): 'default' | (string | { stage: string; form?: string; variants?: string[] })[] {
  const variants = LEGACY_VARIANTS[ch] ?? {};
  const st = glyph.stages;
  const isDefault = st.length === DEFAULT_JOURNEY.length && st.every((s, i) => s.stage === DEFAULT_JOURNEY[i] && s.form === glyph.trad) && !Object.keys(variants).length;
  if (isDefault) return 'default';
  return st.map((s) => {
    const form = s.form === glyph.trad ? undefined : s.form;
    const v = variants[s.stage];
    return form || v ? { stage: s.stage, ...(form ? { form } : {}), ...(v ? { variants: v } : {}) } : s.stage;
  });
}

export function signYaml(c: LegacyChar, story: LegacyStory | undefined, pic: LegacyPicture | undefined, glyph: LegacyGlyphDoc): string {
  const beats = story && {
    topic: tri(story.topic), hook: tri(story.hook),
    ...(story.rotate ? { rotate: tri(story.rotate) } : {}), ...(story.early ? { early: tri(story.early) } : {}),
    ...(story.turn ? { turn: tri(story.turn) } : {}), closer: tri(story.closer),
  };
  const doc = new Document({
    id: c.char, status: 'reviewed', text: { Hans: c.char, Hant: c.trad }, readings: { pinyin: c.pinyin },
    meaning: tri(c.meaning), fact: tri(c.fact),
    ...(beats ? { story: beats } : {}),
    ...(pic ? { picture: { rotate: pic.rotate, ...(pic.ambient ? { ambient: pic.ambient } : {}), svg: pictureSvg(pic.svg) } } : {}),
    journey: journeyFor(c.char, glyph),
  });
  stylize(doc, ['journey']);
  const svg = doc.getIn(['picture', 'svg'], true);
  if (isScalar(svg)) svg.type = Scalar.BLOCK_LITERAL;
  return writeForms(dump(doc, '../../../_schema/sign.schema.json'), formsFromLegacy(glyph));
}

export function uiYaml(strings: Record<string, Tri>): string {
  const doc = new Document({ strings: Object.fromEntries(Object.entries(strings).map(([k, v]) => [k, tri(v)])) });
  stylize(doc, []);
  return dump(doc, '_schema/ui.schema.json');
}

export function collectionYaml(units: LegacyUnit[], storyIds: Map<number, string>): string {
  const doc = new Document({
    id: 'film-36', system: 'han',
    title: { en: 'Thirty-Six Characters', 'zh-Hans': '三十六个字', 'zh-Hant': '三十六個字' },
    featured: FEATURED,
    units: units.map((u) => ({ n: u.n, title: tri(u.title), color: u.color, playable: u.playable, signs: u.chars, ...(storyIds.has(u.n) ? { story: storyIds.get(u.n) } : {}) })),
  });
  stylize(doc, ['featured', 'signs']);
  return dump(doc, '../../_schema/collection.schema.json');
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Legacy steps → story YAML steps: caption+say pairs become `narrate`, tag+say pairs become `tagSay`. */
export function foldSteps(steps: LegacyStep[]): unknown[] {
  const out: unknown[] = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const n = steps[i + 1];
    if (s.do === 'caption' && isTri(s.text) && n && n.do === 'say' && n.lang === 'ui' && n.wait === true && Object.keys(n).length === 4 && sameJson(s.text, n.text)) {
      out.push({ narrate: tri(s.text) });
      i++;
      continue;
    }
    out.push(foldOne(s));
  }
  return out;
}

function foldOne(s: LegacyStep): unknown {
  if (s.do === 'together') {
    const kids = s.steps as LegacyStep[];
    const [a, b] = kids;
    if (kids.length === 2 && a.do === 'tag' && b.do === 'say' && typeof a.dx === 'number' && typeof a.dy === 'number' && Object.keys(a).length === 5
      && b.lang === 'zh' && b.text === a.char && Object.keys(b).length === 3) {
      return { tagSay: { actor: a.actor, sign: a.char, ...(a.dx ? { dx: a.dx } : {}), ...(a.dy ? { dy: a.dy } : {}) } };
    }
    return { do: 'together', steps: foldSteps(kids) };
  }
  const o: Record<string, unknown> = { ...s };
  if (isTri(o.text)) o.text = tri(o.text);
  if (o.glyph && typeof o.glyph === 'object') {
    const { char, ...rest } = o.glyph as Record<string, unknown>;
    o.glyph = { sign: char, ...rest };
  }
  if (s.do === 'tag') {
    const { char, do: kind, actor, ...more } = o;
    return { do: kind, actor, sign: char, ...more };
  }
  return o;
}

export function storyYaml(ch: LegacyChapter, id: string): string {
  const script = foldSteps(ch.script);
  const cast: string[] = [];
  const walk = (steps: unknown[]) => steps.forEach((x) => {
    const s = x as { glyph?: { sign: string }; tagSay?: { sign: string }; do?: string; sign?: string; steps?: unknown[] };
    const ref = s.glyph?.sign ?? s.tagSay?.sign ?? (s.do === 'tag' ? s.sign : undefined);
    if (ref && !cast.includes(ref)) cast.push(ref);
    if (s.steps) walk(s.steps);
  });
  walk(script);
  const doc = new Document({ id, title: tri(ch.title), topic: tri(ch.topic), cast, script });
  stylize(doc, ['cast']);
  stylizeStory(doc);
  return dump(doc, '../../../_schema/story.schema.json');
}

export interface MappedClip { legacy: string; key: string; voiceId: string; spoken: string; bytes: number }

/** Proves every referenced legacy clip by reproducing its old name from the new spoken-text rules, then keys it. */
export function mapLegacyClips(config: Config, legacy: { en: Record<string, string>; zh: Record<string, string> }, legacyDir: string): { mapped: MappedClip[]; orphans: string[] } {
  const voice = (id: string): Voice => {
    const v = config.voices[id];
    if (!v) throw new Error(`config.yaml has no voice ${id}`);
    return v;
  };
  const mapped = new Map<string, MappedClip>();
  const failures: string[] = [];
  const add = (file: string, voiceId: string, spoken: string) => {
    const v = voice(voiceId);
    mapped.set(file, { legacy: file, key: clipKey(v.provider, v.voice, v.rate, spoken), voiceId, spoken, bytes: statSync(path.join(legacyDir, file)).size });
  };
  for (const [raw, file] of Object.entries(legacy.en)) {
    const spoken = spokenText(voice('narr-en'), raw);
    if (legacyClipName('en', spoken) === file) add(file, 'narr-en', spoken);
    else failures.push(`${file} ← ${raw.slice(0, 50)}`);
  }
  const groups = new Map<string, string[]>(); // zh-Hant texts reuse the zh-Hans clip, so group raw texts by file
  for (const [raw, file] of Object.entries(legacy.zh)) groups.set(file, [...(groups.get(file) ?? []), raw]);
  for (const [file, raws] of groups) {
    const hit = raws
      .map((raw) => {
        const voiceId = [...raw.trim()].length === 1 ? 'pron-zh' : 'narr-zh';
        return { voiceId, spoken: spokenText(voice(voiceId), raw) };
      })
      .find((h) => legacyClipName('zh', h.spoken) === file);
    if (hit) add(file, hit.voiceId, hit.spoken);
    else failures.push(`${file} ← ${raws[0].slice(0, 50)}`);
  }
  if (failures.length) throw new Error(`legacy clips whose text no longer reproduces their name:\n${failures.join('\n')}`);
  const orphans = readdirSync(legacyDir).filter((f) => f.endsWith('.mp3') && !mapped.has(f)).sort();
  if (!sameJson(orphans, KNOWN_ORPHANS)) throw new Error(`unexpected unreferenced legacy clips: ${orphans.join(', ')}`);
  if (new Set([...mapped.values()].map((m) => m.key)).size !== mapped.size) throw new Error('two legacy clips map to the same key');
  return { mapped: [...mapped.values()], orphans };
}

function writeClips(config: Config, mapped: MappedClip[], legacyDir: string, mediaDir: string): void {
  mkdirSync(path.join(mediaDir, 'clips'), { recursive: true });
  const manifest: MediaManifest = { v: 1, clips: {} };
  for (const m of mapped) {
    const v = config.voices[m.voiceId];
    copyFileSync(path.join(legacyDir, m.legacy), clipPath(mediaDir, m.key));
    manifest.clips[m.key] = { provider: v.provider, voice: v.voice, rate: v.rate, text: m.spoken, bytes: m.bytes, ms: clipMs(m.bytes) };
  }
  writeMediaManifest(mediaDir, manifest);
}

function main(): void {
  const config = ConfigSchema.parse(parse(readFileSync(path.join(CONTENT_DIR, 'config.yaml'), 'utf8')));
  const chars = golden<LegacyChar[]>('chars');
  const stories = golden<Record<string, LegacyStory>>('stories');
  const pictures = golden<Record<string, LegacyPicture>>('pictures');
  const chapters = golden<LegacyChapter[]>('chapters');
  const units = golden<{ units: LegacyUnit[] }>('units').units;

  const signsDir = path.join(CONTENT_DIR, 'systems', 'han', 'signs');
  mkdirSync(signsDir, { recursive: true });
  for (const c of chars) {
    const glyph = JSON.parse(readFileSync(path.join(LEGACY.glyphs, `${c.char}.json`), 'utf8')) as LegacyGlyphDoc;
    writeFileSync(path.join(signsDir, `${c.char}.yaml`), signYaml(c, stories[c.char], pictures[c.char], glyph));
  }
  writeFileSync(path.join(CONTENT_DIR, 'ui.yaml'), uiYaml(golden<Record<string, Tri>>('strings')));

  const collDir = path.join(CONTENT_DIR, 'collections', 'film-36');
  mkdirSync(path.join(collDir, 'stories'), { recursive: true });
  const storyIds = new Map<number, string>();
  chapters.forEach((ch, i) => {
    const id = slug(ch.title.en);
    storyIds.set(ch.unit, id);
    writeFileSync(path.join(collDir, 'stories', `${String(i + 1).padStart(2, '0')}-${id}.yaml`), storyYaml(ch, id));
  });
  writeFileSync(path.join(collDir, 'collection.yaml'), collectionYaml(units, storyIds));

  mkdirSync(path.join(CONTENT_DIR, 'artifacts'), { recursive: true });
  for (const f of readdirSync(LEGACY.photos).filter((x) => x.endsWith('.jpg'))) copyFileSync(path.join(LEGACY.photos, f), path.join(CONTENT_DIR, 'artifacts', f));

  const legacy = JSON.parse(readFileSync(LEGACY.ttsManifest, 'utf8'));
  const { mapped, orphans } = mapLegacyClips(config, legacy, LEGACY.clips);
  writeClips(config, mapped, LEGACY.clips, MEDIA_DIR);
  console.log(`film36: ${chars.length} signs, ${chapters.length} stories, ${mapped.length} clips; not carried over: ${orphans.join(', ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
