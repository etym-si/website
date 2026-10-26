// The static API: photos, <=20 MiB multi-member .pack.gz shards (Protobuf bundles + MP3 voice sections),
// the catalog, _headers, CREDITS.md and the Arphic licence. Pure: returns files in memory; writeSite() puts them on disk.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  Catalog,
  CollectionBundle,
  L10n,
  LessonB,
  PackMetaB,
  PictureB,
  SignBundle,
  SignSummary,
  StoryBundle,
  StoryRefB,
  StrokesB,
  UnitB,
} from '../../shared/bundle-types.ts';
import { headersFile } from '../../shared/csp.ts';
import { ClipResolver, type MissingClip } from '../audio/clips.ts';
import { readMediaManifest } from '../audio/media.ts';
import type { PackedAudio } from '../audio/pack.ts';
import type { Diags } from '../content/diagnostics.ts';
import { complete } from '../content/l10n.ts';
import type { CollectionDoc, ContentSet, SignDoc, SystemDoc } from '../content/load.ts';
import { pronounceText, primaryReading, qualify, signByKey } from '../content/lookup.ts';
import type { Unit } from '../content/schema.ts';
import { sanitizePicture } from '../content/svg.ts';
import { resolveSignCards, type PhotoUrl } from './cards.ts';
import { creditsMarkdown } from './credits.ts';
import { evolutionScript } from './evolution.ts';
import { formB, HANZI_WRITER_DATA, strokesFor } from './glyph-data.ts';
import { asciiId, hashedName } from './output.ts';
import { packSignShards, packStoriesAndCollections, type SliceLoc } from './pack-shards.ts';
import { checkStory, expandStory, storyGlyphs, storyLabels, storyPictures } from './stories.ts';
import { signTimeline } from './timeline.ts';

export interface SiteStats { signs: number; stories: number; collections: number; photos: number; clips: number; bytes: number }
export interface CompiledSite {
  files: Map<string, Uint8Array>;
  catalog: Catalog;
  stats: SiteStats;
  missing: Map<string, MissingClip>; // clip key → line without a master yet (what `npm run tts` records)
}
export const PALETTE = ['#2fb67c', '#f08a24', '#3d8fe0', '#8b5cf6', '#e8453c', '#d99a00'];

/** Explicit lessons, or the default rule: chunks of two new signs, a review, and a story node if the unit has a story. */
export function unitLessons(collection: string, n: number, unit: Unit, keys: string[], system: string): LessonB[] {
  const id = (l: string) => `${collection}/u${n}-${l}`;
  if (unit.lessons) return unit.lessons.map((l) => ({ id: id(l.id), unit: n, kind: l.kind, signs: l.signs ? l.signs.map((r) => qualify(r, system)) : keys }));
  const out: LessonB[] = [];
  for (let i = 0; i < keys.length; i += 2) out.push({ id: id(`l${i / 2 + 1}`), unit: n, kind: 'learn', signs: keys.slice(i, i + 2) });
  out.push({ id: id('review'), unit: n, kind: 'review', signs: keys });
  if (unit.story) out.push({ id: id('story'), unit: n, kind: 'story', signs: keys });
  return out;
}

export function compileSite(content: ContentSet, opts: { mediaDir: string; strict: boolean }, diags: Diags): CompiledSite {
  const files = new Map<string, Uint8Array>();
  const enc = new TextEncoder();
  const L = (t: L10n) => complete(content, t);
  const clips = new ClipResolver(content, readMediaManifest(opts.mediaDir), opts.mediaDir);
  const stats: SiteStats = { signs: 0, stories: 0, collections: 0, photos: 0, clips: 0, bytes: 0 };
  const put = (dir: string, base: string, ext: string, bytes: Uint8Array): string => {
    const rel = `${dir}/${hashedName(base, ext, bytes)}`;
    files.set(rel, bytes);
    return rel;
  };
  const countClips = (packed: PackedAudio | null): PackedAudio | null => {
    if (packed) stats.clips += Object.keys(packed.clips).length;
    return packed;
  };
  /** Report clips that have no master yet, against the file that needs them. */
  const coverage = (where: { y: SignDoc['y'] }, before: number) => {
    for (const [, { text }] of [...clips.missing].slice(before)) {
      diags.add(opts.strict ? 'error' : 'warning', where.y, [], `no narration clip for "${text.length > 60 ? `${text.slice(0, 57)}…` : text}" (run npm run tts)`);
    }
  };

  // photos
  const photoUrls = new Map<string, string>();
  for (const a of content.artifacts.values()) {
    if (!existsSync(a.photoAbs)) continue; // reported by the validator
    photoUrls.set(a.data.id, put('data/photos', a.data.id, path.extname(a.data.image.file).slice(1), readFileSync(a.photoAbs)));
    stats.photos++;
  }
  const photoUrl: PhotoUrl = (id) => {
    const u = photoUrls.get(id);
    if (!u) throw new Error(`no photo for artifact ${id}`);
    return u;
  };

  // signs reachable from published collections (in collection → unit → sign order)
  const published = content.config.data.collections.map((id) => content.collections.get(id)).filter((c): c is CollectionDoc => !!c);
  const reachable = new Map<string, SignDoc>();
  for (const c of published) {
    const refs = [...c.data.units.flatMap((u) => u.signs), ...[...c.stories.values()].flatMap((s) => s.data.cast)];
    for (const ref of refs) {
      const key = qualify(ref, c.data.system);
      const s = signByKey(content, key);
      if (s) reachable.set(key, s);
    }
  }

  const names = new Map<string, string>();
  const compiledSigns: { key: string; bundle: Omit<SignBundle, 'audio'>; packed: PackedAudio | null }[] = [];
  for (const [key, sign] of reachable) {
    const sys = content.systems.get(sign.system)!;
    const name = asciiId(sign.data.id);
    const slot = `${sign.system}/${name.toLowerCase()}`;
    if (names.has(slot)) { diags.error(sign.y, ['id'], `compiled name ${name} collides with ${names.get(slot)}`); continue; }
    names.set(slot, key);
    const before = clips.missing.size;
    try {
      const { bundle, sections } = buildSignBundle(content, sys, sign, photoUrl, clips);
      compiledSigns.push({ key, bundle, packed: countClips(clips.pack(sections)) });
      stats.signs++;
    } catch (e) {
      diags.error(sign.y, [], (e as Error).message);
    }
    coverage(sign, before);
  }

  const packs: PackMetaB[] = [];
  const signLocs = packSignShards(compiledSigns, files, packs);

  // stories and collections
  const compiledStories: { key: string; collId: string; bundle: Omit<StoryBundle, 'audio'>; packed: PackedAudio | null }[] = [];
  const collAudioByColl = new Map<string, PackedAudio | null>();

  for (const coll of published) {
    const id = coll.data.id;
    for (const story of [...coll.stories.values()].sort((a, b) => a.order - b.order)) {
      const unitIndex = coll.data.units.findIndex((u) => u.story === story.data.id);
      if (unitIndex < 0) continue; // unlinked stories are not published (the validator warns)
      const n = coll.data.units[unitIndex].n ?? unitIndex + 1;
      const errors = diags.errors.length;
      checkStory(content, coll, story, diags);
      if (diags.errors.length > errors) continue;
      const before = clips.missing.size;
      const script = clips.attach(expandStory(content, coll, story));
      const pictures = storyPictures(content, script);
      const bundle: Omit<StoryBundle, 'audio'> = {
        v: 1, collection: id, id: story.data.id, unit: n, title: L(story.data.title), topic: L(story.data.topic),
        script, glyphs: storyGlyphs(content, script), labels: storyLabels(content, script),
        ...(Object.keys(pictures).length ? { pictures } : {}),
      };
      compiledStories.push({
        key: `${id}/${story.data.id}`,
        collId: id,
        bundle,
        packed: countClips(clips.pack(clips.sectionKeys(script))),
      });
      stats.stories++;
      coverage(story, before);
    }
    const before = clips.missing.size;
    const { prons } = buildCollection(content, coll, signLocs, new Map(), clips);
    const sections = clips.sectionKeys([], prons);
    collAudioByColl.set(id, countClips(clips.pack(sections)));
    stats.collections++;
    coverage(coll, before);
  }

  const { collectionLocs } = packStoriesAndCollections(
    compiledStories,
    (storyLocs) =>
      published.map((coll) => {
        const id = coll.data.id;
        const storyRefs = new Map<string, StoryRefB>();
        for (const st of compiledStories.filter((s) => s.collId === id)) {
          const loc = storyLocs.get(st.key)!;
          storyRefs.set(st.bundle.id, {
            id: st.bundle.id,
            unit: st.bundle.unit,
            title: st.bundle.title,
            topic: st.bundle.topic,
            file: loc.file,
            range: loc.range,
          });
        }
        const { bundle } = buildCollection(content, coll, signLocs, storyRefs, clips);
        return { key: id, bundle, packed: collAudioByColl.get(id) ?? null };
      }),
    files,
    packs,
  );

  const catalog = buildCatalog(content, published, collectionLocs, packs);
  const usesHanziWriter = [...content.systems.values()].some((s) => s.data.ingest.strokes === 'hanzi-writer-data');
  files.set('_headers', enc.encode(headersFile()));
  files.set('CREDITS.md', enc.encode(creditsMarkdown(content, [...reachable.values()], usesHanziWriter)));
  if (usesHanziWriter) files.set('licenses/ARPHICPL.TXT', readFileSync(path.join(HANZI_WRITER_DATA, 'ARPHICPL.TXT')));
  stats.bytes = [...files.values()].reduce((n, b) => n + b.length, 0);
  return { files, catalog, stats, missing: clips.missing };
}

function buildSignBundle(content: ContentSet, sys: SystemDoc, sign: SignDoc, photoUrl: PhotoUrl, clips: ClipResolver): { bundle: Omit<SignBundle, 'audio'>; sections: { id: string; keys: string[] }[] } {
  const L = (t: L10n) => complete(content, t);
  const d = sign.data;
  const timeline = signTimeline(sys, sign);
  const full = clips.attach(evolutionScript(content, sys, sign));
  const compact = clips.attach(evolutionScript(content, sys, sign, { compact: true }));
  const spoken = pronounceText(sys, sign);
  const pron = spoken ? clips.pronunciation(spoken, sys.data.pronounce?.voice) : undefined;
  const strokes: Record<string, StrokesB> = {};
  for (const st of sys.data.stages) {
    if (st.kind !== 'strokes' || !st.script || !timeline.includes(st.id)) continue;
    const text = d.text[st.script];
    const data = text ? strokesFor(sys, text) : null;
    if (!data) throw new Error(`no stroke data for ${text ?? '(missing text)'} (stage ${st.id})`);
    strokes[text] = data;
  }
  let picture: PictureB | undefined;
  if (d.picture) {
    const r = sanitizePicture(d.picture.svg);
    if (!r.ok) throw new Error(`picture.svg: ${r.error}`);
    picture = { rotate: d.picture.rotate, ...(d.picture.ambient ? { ambient: d.picture.ambient } : {}), tree: r.tree };
  }
  const bundle: Omit<SignBundle, 'audio'> = {
    v: 1, key: sign.key, system: sys.data.id, id: d.id, status: d.status ?? 'draft',
    text: d.text, readings: d.readings, reading: primaryReading(sys, sign),
    meaning: L(d.meaning), fact: L(d.fact),
    ...(d.story ? { topic: L(d.story.topic) } : {}),
    ...(d.origin ? { origin: { type: d.origin.type, ...(d.origin.parts ? { parts: d.origin.parts.map((p) => ({ char: p.char, role: p.role, ...(p.gloss ? { gloss: L(p.gloss) } : {}) })) } : {}) } } : {}),
    ...(d.sources ? { sources: d.sources } : {}),
    ...(sign.ext ? { ext: sign.ext } : {}),
    ...(picture ? { picture } : {}),
    forms: (d.forms ?? []).map(formB),
    strokes,
    stages: timeline,
    cards: resolveSignCards(content, sys, sign, photoUrl, timeline),
    scripts: { full, compact },
    ...(pron ? { clip: pron } : {}),
  };
  return { bundle, sections: clips.sectionKeys([...full, ...compact], pron ? [pron] : []) };
}

function buildCollection(content: ContentSet, coll: CollectionDoc, signLocs: Map<string, SliceLoc>, storyFiles: Map<string, StoryRefB>, clips: ClipResolver): { bundle: Omit<CollectionBundle, 'audio'>; prons: string[] } {
  const L = (t: L10n) => complete(content, t);
  const system = coll.data.system;
  const sys = content.systems.get(system)!;
  const units: UnitB[] = [];
  const lessons: LessonB[] = [];
  const signs: Record<string, SignSummary> = {};
  const prons: string[] = [];
  coll.data.units.forEach((u, i) => {
    const n = u.n ?? i + 1;
    const keys = u.signs.map((r) => qualify(r, system)).filter((k) => signLocs.has(k));
    units.push({ n, title: L(u.title), color: u.color ?? PALETTE[i % PALETTE.length], playable: u.playable ?? true, signs: keys, ...(u.story && storyFiles.has(u.story) ? { story: u.story } : {}) });
    lessons.push(...unitLessons(coll.data.id, n, { ...u, story: u.story && storyFiles.has(u.story) ? u.story : undefined }, keys, system));
    for (const key of keys) {
      const s = signByKey(content, key)!;
      const spoken = pronounceText(sys, s);
      const clip = spoken ? clips.pronunciation(spoken, sys.data.pronounce?.voice) : undefined;
      if (clip && !prons.includes(clip)) prons.push(clip);
      const loc = signLocs.get(key)!;
      signs[key] = { key, id: s.data.id, text: s.data.text, reading: primaryReading(sys, s), meaning: L(s.data.meaning), file: loc.file, range: loc.range, ...(clip ? { clip } : {}) };
    }
  });
  const featured = (coll.data.featured ?? []).map((r) => qualify(r, system)).filter((k) => signLocs.has(k));
  return { bundle: { v: 1, id: coll.data.id, system, title: L(coll.data.title), featured, units, lessons, signs, stories: [...storyFiles.values()] }, prons };
}

function buildCatalog(content: ContentSet, published: CollectionDoc[], collectionLocs: Map<string, SliceLoc>, packs: PackMetaB[]): Catalog {
  const L = (t: L10n) => complete(content, t);
  const systemIds = [...new Set(published.map((c) => c.data.system))];
  return {
    v: 1,
    locales: content.config.data.locales.map((l) => ({ id: l.id, lang: l.lang, section: l.section })),
    ui: Object.fromEntries(Object.entries(content.ui.data.strings).map(([k, v]) => [k, L(v)])),
    systems: systemIds.map((id) => content.systems.get(id)!).map((s) => ({
      id: s.data.id, name: L(s.data.name), signNoun: L(s.data.signNoun), textScripts: s.data.textScripts,
      stages: s.data.stages.map((st) => ({
        id: st.id, kind: st.kind, icon: st.icon, color: st.color, name: L(st.name), era: L(st.era),
        ...(st.script ? { script: st.script } : {}), ...(st.quiz === false ? { quiz: false } : {}),
      })),
      variantNotes: Object.fromEntries(Object.entries(s.data.variantNotes ?? {}).map(([k, v]) => [k, L(v)])),
    })),
    collections: published.filter((c) => collectionLocs.has(c.data.id)).map((c) => {
      const loc = collectionLocs.get(c.data.id)!;
      return { id: c.data.id, system: c.data.system, title: L(c.data.title), file: loc.file, range: loc.range };
    }),
    packs,
  };
}
