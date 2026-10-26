import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CollectionBundle, SignBundle, Step, StoryBundle } from '../../shared/bundle-types.ts';
import { walkSteps } from '../../tools/compile/stories.ts';
import { compileSite } from '../../tools/compile/site.ts';
import { Diags } from '../../tools/content/diagnostics.ts';
import { MEDIA_DIR } from '../../tools/paths.ts';
import { realContent } from '../helpers/content.ts';
import { EGYPT_FIXTURE, loadFixture } from '../helpers/fixture.ts';

const diags = new Diags();
const site = compileSite(realContent(), { mediaDir: MEDIA_DIR, strict: true }, diags);
const json = <T>(rel: string): T => JSON.parse(new TextDecoder().decode(site.files.get(rel)!)) as T;
const find = (re: RegExp) => [...site.files.keys()].filter((k) => re.test(k));

test('the film corpus compiles cleanly in strict mode into ~100 files', () => {
  assert.deepEqual(diags.lines(), []);
  assert.equal(find(/^data\/signs\/han\/[^/]+\.json$/).length, 36);
  assert.equal(find(/^data\/signs\/han\/[^/]+\.mp3$/).length, 36);
  assert.equal(find(/^data\/stories\/film-36\/[^/]+\.json$/).length, 6);
  assert.equal(find(/^data\/stories\/film-36\/[^/]+\.mp3$/).length, 6);
  assert.equal(find(/^data\/collections\/film-36\.[0-9a-f]{10}\.(json|mp3)$/).length, 2);
  assert.equal(find(/^data\/photos\//).length, 13);
  for (const f of ['_headers', 'CREDITS.md', 'licenses/ARPHICPL.TXT']) assert.ok(site.files.has(f), f);
  assert.equal(site.files.size, 102);
});

test('a sign bundle carries everything for one sign, and its MP3 holds one section per voice', () => {
  const coll = json<CollectionBundle>(site.catalog.collections[0].file);
  const 马 = json<SignBundle>(coll.signs['han/马'].file);
  assert.equal(马.key, 'han/马');
  assert.deepEqual(马.stages, ['picture', 'oracle', 'bronze', 'seal', 'clerical', 'regular', 'simplified']);
  assert.deepEqual(Object.keys(马.strokes).sort(), ['马', '馬'].sort());
  assert.equal(马.picture?.rotate, 90);
  assert.equal(马.cards.bronze[0]?.kind, 'appears');
  assert.deepEqual(Object.keys(马.audio!.sections), ['en', 'zh']);
  const mp3 = site.files.get(马.audio!.mp3)!;
  for (const [start] of Object.values(马.audio!.sections)) assert.deepEqual([...mp3.subarray(start, start + 4)], [0xff, 0xf3, 0x64, 0xc4]);
  assert.ok(马.audio!.clips[马.clip!].en && 马.audio!.clips[马.clip!].zh, 'pronunciation in every section');
});

test('every say step in every bundle has a clip for every locale', () => {
  const check = (steps: Step[], where: string) => walkSteps(steps, (s) => {
    if (s.do === 'say' && !s.silent) assert.deepEqual(Object.keys(s.clip ?? {}).sort(), ['en', 'zh-Hans', 'zh-Hant'], where);
  });
  for (const f of find(/^data\/signs\/.*\.json$/)) { const b = json<SignBundle>(f); check(b.scripts.full, f); check(b.scripts.compact, f); }
  for (const f of find(/^data\/stories\/.*\.json$/)) check(json<StoryBundle>(f).script, f);
});

test('the collection bundle has lessons by the default rule and every pronunciation', () => {
  const coll = json<CollectionBundle>(site.catalog.collections[0].file);
  assert.deepEqual(coll.lessons.slice(0, 5).map((l) => l.id), ['film-36/u1-l1', 'film-36/u1-l2', 'film-36/u1-l3', 'film-36/u1-review', 'film-36/u1-story']);
  assert.equal(Object.keys(coll.signs).length, 36);
  assert.equal(Object.keys(coll.audio!.clips).length, 36);
  assert.deepEqual(coll.stories.map((s) => s.unit), [1, 2, 3, 4, 5, 6]);
});

test('_headers sends the strict CSP with blob: media and immutable caching', () => {
  const h = new TextDecoder().decode(site.files.get('_headers')!);
  assert.match(h, /Content-Security-Policy: default-src 'self';.* media-src 'self' blob:;.* frame-ancestors 'none'/);
  assert.match(h, /\/data\/\*\n  Cache-Control: public, max-age=31536000, immutable/);
  assert.match(h, /X-Frame-Options: DENY/);
});

test('the Egyptian fixture compiles too (no audio yet: warnings only)', () => {
  const { content, diags: d } = loadFixture(EGYPT_FIXTURE);
  const s = compileSite(content!, { mediaDir: MEDIA_DIR, strict: false }, d);
  assert.equal(d.errors.length, 0, d.lines().join('\n'));
  assert.ok(d.warnings.some((w) => w.message.includes('no narration clip')));
  const coll = JSON.parse(new TextDecoder().decode(s.files.get(s.catalog.collections[0].file)!)) as CollectionBundle;
  const g17 = JSON.parse(new TextDecoder().decode(s.files.get(coll.signs['egyptian/G17'].file)!)) as SignBundle;
  assert.deepEqual(g17.stages, ['hieroglyph', 'hieratic', 'demotic']);
  assert.equal(g17.audio, null);
});
