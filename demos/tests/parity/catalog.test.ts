import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CollectionBundle, SignBundle } from '../../shared/bundle-types.ts';
import { parseSvg } from '../../tools/content/svg.ts';
import { compileSite } from '../../tools/compile/site.ts';
import { Diags } from '../../tools/content/diagnostics.ts';
import { MEDIA_DIR } from '../../tools/paths.ts';
import { realContent } from '../helpers/content.ts';
import { golden, tri, type Tri } from './normalize.ts';

const site = compileSite(realContent(), { mediaDir: MEDIA_DIR, strict: true }, new Diags());
const json = <T>(rel: string): T => JSON.parse(new TextDecoder().decode(site.files.get(rel)!)) as T;
const coll = json<CollectionBundle>(site.catalog.collections[0].file);

test('UI strings match today', () => {
  const legacy = golden<Record<string, Tri>>('strings');
  assert.deepEqual(site.catalog.ui, Object.fromEntries(Object.entries(legacy).map(([k, v]) => [k, tri(v)])));
});

test('stages and variant notes match today', () => {
  const legacy = golden<{ stages: { id: string; icon: string; color: string; name: Tri; era: Tri }[]; variantNotes: Record<string, Tri> }>('stages');
  const han = site.catalog.systems.find((s) => s.id === 'han')!;
  assert.deepEqual(han.stages.map(({ id, icon, color, name, era }) => ({ id, icon, color, name, era })), legacy.stages.map((s) => ({ ...s, name: tri(s.name), era: tri(s.era) })));
  assert.deepEqual(han.variantNotes, Object.fromEntries(Object.entries(legacy.variantNotes).map(([k, v]) => [k, tri(v)])));
});

test('units and lessons match today (film-36/ ids, han/ sign keys)', () => {
  const legacy = golden<{ units: { n: number; title: Tri; chars: string[]; color: string; playable: boolean }[]; lessons: { id: string; unit: number; kind: string; chars: string[] }[] }>('units');
  assert.deepEqual(coll.units.map(({ n, title, signs, color, playable }) => ({ n, title, signs, color, playable })),
    legacy.units.map((u) => ({ n: u.n, title: tri(u.title), signs: u.chars.map((c) => `han/${c}`), color: u.color, playable: u.playable })));
  assert.deepEqual(coll.lessons, legacy.lessons.map((l) => ({ id: `film-36/${l.id}`, unit: l.unit, kind: l.kind, signs: l.chars.map((c) => `han/${c}`) })));
});

test('pictures compile to the same element trees as today', () => {
  for (const [ch, p] of Object.entries(golden<Record<string, { rotate: number; ambient: string | null; svg: string }>>('pictures'))) {
    const b = json<SignBundle>(coll.signs[`han/${ch}`].file);
    const g = parseSvg(p.svg);
    delete g[1].xmlns;
    assert.deepEqual(b.picture, { rotate: p.rotate, ...(p.ambient ? { ambient: p.ambient } : {}), tree: [g] }, ch);
  }
});
