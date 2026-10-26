// Light re-check of fetched bundles before they touch the DOM (spec §11): the fields the renderer turns into
// SVG attributes, URLs or media must have the expected shape. Text always goes through textContent anyway.
import type { CollectionBundle, SignBundle, StoryBundle } from './bundle-types.ts';
import { checkSvgTree, PATH_D, TRANSFORM, type SvgNode } from './svg-tree.ts';

/** Every compiled asset path: data/<dirs>/<name>.<10-hex hash>.<ext>. */
export const DATA_FILE = /^data\/[a-z0-9/-]+\/[A-Za-z0-9-]+\.[0-9a-f]{10}\.(json|mp3|jpg|png)$/;
const COMMONS_PAGE = /^https:\/\/commons\.wikimedia\.org\/wiki\/\S+$/;

const fail = (what: string): never => { throw new Error(`bad bundle: ${what}`); };
const obj = (v: unknown, what: string): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(what));
const arr = (v: unknown, what: string): unknown[] => (Array.isArray(v) ? v : fail(what));
const str = (v: unknown, what: string): string => (typeof v === 'string' ? v : fail(what));
const num = (v: unknown, what: string): number => (typeof v === 'number' && Number.isFinite(v) ? v : fail(what));
const file = (v: unknown, what: string): string => (DATA_FILE.test(str(v, what)) ? (v as string) : fail(`${what} file path`));

function checkForm(v: unknown, what: string): void {
  const f = obj(v, what);
  const box = arr(f.box, `${what}.box`);
  if (box.length !== 4) fail(`${what}.box`);
  box.forEach((n, i) => num(n, `${what}.box[${i}]`));
  arr(f.paths, `${what}.paths`).forEach((p, i) => {
    const q = obj(p, `${what}.paths[${i}]`);
    if (!PATH_D.test(str(q.d, `${what}.paths[${i}].d`))) fail(`${what}.paths[${i}] path data`);
    if (q.t !== undefined && !TRANSFORM.test(str(q.t, `${what}.paths[${i}].t`))) fail(`${what}.paths[${i}] transform`);
    if (q.mode !== undefined && q.mode !== 'stroke' && q.mode !== 'knockout') fail(`${what}.paths[${i}].mode`);
    if (q.w !== undefined) num(q.w, `${what}.paths[${i}].w`);
  });
}

function checkStrokes(v: unknown, what: string): void {
  const s = obj(v, what);
  arr(s.strokes, `${what}.strokes`).forEach((d, i) => { if (!PATH_D.test(str(d, `${what}.strokes[${i}]`))) fail(`${what}.strokes[${i}] path data`); });
  arr(s.medians, `${what}.medians`).forEach((m, i) => arr(m, `${what}.medians[${i}]`).forEach((pt) => {
    const p = arr(pt, `${what}.medians[${i}]`);
    if (p.length !== 2) fail(`${what}.medians[${i}]`);
    num(p[0], `${what}.medians`); num(p[1], `${what}.medians`);
  }));
}

function checkPhoto(v: unknown, what: string): void {
  const p = obj(v, what);
  file(p.file, `${what}.file`); num(p.w, `${what}.w`); num(p.h, `${what}.h`);
  if (!COMMONS_PAGE.test(str(p.page, `${what}.page`))) fail(`${what}.page`);
}

function checkCard(v: unknown, what: string): void {
  const c = obj(v, what);
  if (!['exact', 'book', 'appears', 'example'].includes(str(c.kind, `${what}.kind`))) fail(`${what}.kind`);
  checkPhoto(c.img, `${what}.img`);
  if (c.img2 !== undefined) checkPhoto(c.img2, `${what}.img2`);
  if (c.marks !== undefined) arr(c.marks, `${what}.marks`).forEach((m, i) => { const k = obj(m, `${what}.marks[${i}]`); for (const n of ['x', 'y', 'w', 'h']) num(k[n], `${what}.marks[${i}].${n}`); });
  obj(c.title, `${what}.title`); obj(c.text, `${what}.text`);
}

function checkAudio(v: unknown, what: string): void {
  if (v === null) return;
  const a = obj(v, what);
  file(a.mp3, `${what}.mp3`);
  for (const [k, r] of Object.entries(obj(a.sections, `${what}.sections`))) { const x = arr(r, `${what}.sections.${k}`); num(x[0], what); num(x[1], what); }
  obj(a.clips, `${what}.clips`);
}

function checkPicture(v: unknown): void {
  const p = obj(v, 'picture');
  num(p.rotate, 'picture.rotate');
  const err = checkSvgTree(arr(p.tree, 'picture.tree') as SvgNode[]);
  if (err) fail(`picture: ${err}`);
}

export function checkSignBundle(v: unknown): SignBundle {
  const o = obj(v, 'sign');
  if (o.v !== 1) fail('version');
  str(o.key, 'key'); obj(o.text, 'text'); str(o.reading, 'reading');
  arr(o.forms, 'forms').forEach((f, i) => checkForm(f, `forms[${i}]`));
  for (const [k, s] of Object.entries(obj(o.strokes, 'strokes'))) checkStrokes(s, `strokes.${k}`);
  if (o.picture !== undefined) checkPicture(o.picture);
  for (const [k, list] of Object.entries(obj(o.cards, 'cards'))) arr(list, `cards.${k}`).forEach((c, i) => { if (c !== null) checkCard(c, `cards.${k}[${i}]`); });
  const sc = obj(o.scripts, 'scripts');
  arr(sc.full, 'scripts.full'); arr(sc.compact, 'scripts.compact');
  checkAudio(o.audio, 'audio');
  return o as unknown as SignBundle;
}

export function checkStoryBundle(v: unknown): StoryBundle {
  const o = obj(v, 'story');
  if (o.v !== 1) fail('version');
  arr(o.script, 'script');
  for (const [k, g] of Object.entries(obj(o.glyphs, 'glyphs'))) {
    const d = obj(g, `glyphs.${k}`);
    if (d.kind === 'paths') checkForm(d.form, `glyphs.${k}.form`);
    else if (d.kind === 'strokes') checkStrokes(d.strokes, `glyphs.${k}.strokes`);
    else fail(`glyphs.${k}.kind`);
  }
  obj(o.labels, 'labels');
  checkAudio(o.audio, 'audio');
  return o as unknown as StoryBundle;
}

export function checkCollectionBundle(v: unknown): CollectionBundle {
  const o = obj(v, 'collection');
  if (o.v !== 1) fail('version');
  arr(o.units, 'units'); arr(o.lessons, 'lessons');
  for (const [k, s] of Object.entries(obj(o.signs, 'signs'))) file(obj(s, `signs.${k}`).file, `signs.${k}`);
  arr(o.stories, 'stories').forEach((s, i) => file(obj(s, `stories[${i}]`).file, `stories[${i}]`));
  checkAudio(o.audio, 'audio');
  return o as unknown as CollectionBundle;
}
