// The planned renames between tests/golden (legacy) and compiled output — and nothing else.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { CardB, L10n, PhotoB, Step } from '../../shared/bundle-types.ts';
import { GOLDEN_DIR } from '../../tools/paths.ts';

export type Tri = { en: string; zhs: string; zht: string };
type LegacyPhoto = { file: string; w: number; h: number; title: string; license: string; author: string; page: string };
type LegacyCard = { kind: string; img: LegacyPhoto; img2?: LegacyPhoto; marks?: { x: number; y: number; w: number; h: number; label?: Tri }[]; form?: { stage: string; index: number }; disp: string; title: Tri; text: Tri; source?: string };

export const golden = <T = unknown>(name: string): T => JSON.parse(readFileSync(path.join(GOLDEN_DIR, `${name}.json`), 'utf8')) as T;
export const tri = (t: Tri): L10n => ({ en: t.en, 'zh-Hans': t.zhs, 'zh-Hant': t.zht });
const isTri = (v: unknown): v is Tri => !!v && typeof v === 'object' && 'zhs' in v;
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T; // drops undefined
const stem = (file: string) => path.basename(file).split('.')[0];
const photo = (p: LegacyPhoto | PhotoB) => ({ file: stem(p.file), w: p.w, h: p.h, title: p.title, license: p.license, author: p.author, page: p.page });

export function legacyCard(c: LegacyCard | null): unknown {
  if (!c) return null;
  return clean({
    kind: c.kind, img: photo(c.img), img2: c.img2 && photo(c.img2),
    marks: c.marks?.map((m) => ({ x: m.x, y: m.y, w: m.w, h: m.h, label: m.label && tri(m.label) })),
    form: c.form, title: tri(c.title), text: tri(c.text), source: c.source,
  });
}

export function compiledCard(c: CardB | null | undefined, shown: string): unknown {
  if (!c) return null;
  const fillShown = (t: L10n) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.replaceAll('{shown}', shown)]));
  return clean({
    kind: c.kind, img: photo(c.img), img2: c.img2 && photo(c.img2),
    marks: c.marks?.map((m) => ({ x: m.x, y: m.y, w: m.w, h: m.h, label: m.label && fillShown(m.label) })),
    form: c.form, title: fillShown(c.title), text: fillShown(c.text), source: c.source,
  });
}

/** Legacy step → compiled shape: Tri → L10n, `char` → `sign: 'han/…'`, `pic` → `'han/…'`. */
export function legacyStep(s: Record<string, unknown>): Step {
  const o: Record<string, unknown> = { ...s };
  if (isTri(o.text)) o.text = tri(o.text);
  if (o.glyph && typeof o.glyph === 'object') {
    const { char, ...rest } = o.glyph as Record<string, unknown>;
    o.glyph = { sign: `han/${char}`, ...rest };
  }
  if (o.do === 'tag') {
    const { char, ...rest } = o;
    return clean({ ...rest, sign: `han/${char}` }) as Step;
  }
  if (o.do === 'picture') o.pic = `han/${o.pic}`;
  if (o.do === 'together') o.steps = (o.steps as Record<string, unknown>[]).map(legacyStep);
  return clean(o) as Step;
}

/** Compiled steps without the added `clip` fields. */
export function stripClips(steps: Step[]): Step[] {
  return steps.map((s) => {
    if (s.do === 'together') return { ...s, steps: stripClips(s.steps) };
    if (s.do === 'say') { const { clip: _clip, ...rest } = s; return rest; }
    return s;
  });
}
