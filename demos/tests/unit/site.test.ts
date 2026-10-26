import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import type { Step } from '../../shared/bundle-types.ts';
import { MAX_PACK_BYTES, gunzipSlice, readCollectionSlice, readSignSlice, readStorySlice } from '../../tools/compile/pack-shards.ts';
import { walkSteps } from '../../tools/compile/stories.ts';
import { compileSite } from '../../tools/compile/site.ts';
import { Diags } from '../../tools/content/diagnostics.ts';
import { MEDIA_DIR } from '../../tools/paths.ts';
import { realContent } from '../helpers/content.ts';
import { EGYPT_FIXTURE, loadFixture } from '../helpers/fixture.ts';

const diags = new Diags();
const site = compileSite(realContent(), { mediaDir: MEDIA_DIR, strict: true }, diags);
const find = (re: RegExp) => [...site.files.keys()].filter((k) => re.test(k));

test('the full corpus compiles cleanly in strict mode into <=20 MiB multi-member .pack.gz shards (~22 files total)', () => {
  assert.deepEqual(diags.lines(), []);
  const packs = find(/^data\/packs\/pack-\d{2}\.[0-9a-f]{10}\.pack\.gz$/);
  assert.ok(packs.length >= 5 && packs.length <= 12, `expected 5..12 .pack.gz shards, got ${packs.length}`);
  assert.equal(site.catalog.packs?.length, packs.length);
  for (const p of packs) {
    const bytes = site.files.get(p)!;
    assert.ok(bytes.length <= MAX_PACK_BYTES, `${p} exceeds 20 MiB: ${bytes.length}`);
    // Whole .pack.gz file is a valid RFC 1952 multi-member gzip archive
    const decompressed = zlib.gunzipSync(bytes);
    assert.ok(decompressed.length > bytes.length, `${p} gunzips cleanly as a whole .gz archive`);
  }
  // Zero loose per-sign/story/collection .json or .mp3 files remain
  assert.equal(find(/^data\/(signs|stories|collections)\//).length, 0);
  assert.equal(find(/^data\/photos\//).length, 13);
  for (const f of ['_headers', 'CREDITS.md', 'licenses/ARPHICPL.TXT']) assert.ok(site.files.has(f), f);
  assert.equal(site.files.size, packs.length + 13 + 3);
});

test('a sign bundle is lazy-decoded from its .pack.gz byte range, and its audio sections gunzip to valid MP3 frames', () => {
  const coll = readCollectionSlice(site.files, site.catalog.collections[0]);
  const 马 = readSignSlice(site.files, coll.signs['han/马']);
  assert.equal(马.key, 'han/马');
  assert.deepEqual(马.stages, ['picture', 'oracle', 'bronze', 'seal', 'clerical', 'regular', 'simplified']);
  assert.deepEqual(Object.keys(马.strokes).sort(), ['马', '馬'].sort());
  assert.equal(马.picture?.rotate, 90);
  assert.equal(马.cards.bronze[0]?.kind, 'appears');
  const secIds = Object.keys(马.audio!.sections);
  assert.ok(secIds.includes('en') && secIds.includes('zh') && secIds.includes('narr-en-ava') && secIds.includes('narr-zh-xiaoyi'));
  const packBytes = site.files.get(马.audio!.mp3)!;
  for (const range of Object.values(马.audio!.sections)) {
    const mp3 = gunzipSlice(packBytes, range);
    assert.deepEqual([...mp3.subarray(0, 4)], [0xff, 0xf3, 0x64, 0xc4]);
  }
  assert.ok(马.audio!.clips[马.clip!].en && 马.audio!.clips[马.clip!].zh, 'pronunciation in every section');
});

test('every say step in every bundle has a clip for every locale', () => {
  const check = (steps: Step[], where: string) => walkSteps(steps, (s) => {
    if (s.do === 'say' && !s.silent) assert.deepEqual(Object.keys(s.clip ?? {}).sort(), ['en', 'zh-Hans', 'zh-Hant'], where);
  });
  const seenSigns = new Set<string>();
  for (const cRef of site.catalog.collections) {
    const coll = readCollectionSlice(site.files, cRef);
    for (const sRef of Object.values(coll.signs)) {
      if (seenSigns.has(sRef.key)) continue;
      seenSigns.add(sRef.key);
      const b = readSignSlice(site.files, sRef);
      check(b.scripts.full, sRef.key);
      check(b.scripts.compact, sRef.key);
    }
    for (const stRef of coll.stories) {
      const st = readStorySlice(site.files, stRef);
      check(st.script, stRef.id);
    }
  }
  assert.equal(seenSigns.size, 502);
});

test('the collection bundle has lessons by the default rule and every pronunciation', () => {
  const coll = readCollectionSlice(site.files, site.catalog.collections[0]);
  assert.deepEqual(coll.lessons.slice(0, 5).map((l) => l.id), ['film-36/u1-l1', 'film-36/u1-l2', 'film-36/u1-l3', 'film-36/u1-review', 'film-36/u1-story']);
  assert.equal(Object.keys(coll.signs).length, 36);
  assert.equal(Object.keys(coll.audio!.clips).length, 36);
  assert.deepEqual(coll.stories.map((s) => s.unit), [1, 2, 3, 4, 5, 6]);
});

test('_headers sends the strict CSP with blob: media, immutable caching, and octet-stream for .pack.gz shards', () => {
  const h = new TextDecoder().decode(site.files.get('_headers')!);
  assert.match(h, /Content-Security-Policy: default-src 'self';.* media-src 'self' blob:;.* frame-ancestors 'none'/);
  assert.match(h, /\/data\/\*\n  Cache-Control: public, max-age=31536000, immutable/);
  assert.match(h, /\/data\/packs\/\*\n  Content-Type: application\/octet-stream/);
  assert.match(h, /X-Frame-Options: DENY/);
});

test('the Egyptian fixture compiles into a .pack.gz shard too (no audio yet: warnings only)', () => {
  const { content, diags: d } = loadFixture(EGYPT_FIXTURE);
  const s = compileSite(content!, { mediaDir: MEDIA_DIR, strict: false }, d);
  assert.equal(d.errors.length, 0, d.lines().join('\n'));
  assert.ok(d.warnings.some((w) => w.message.includes('no narration clip')));
  const coll = readCollectionSlice(s.files, s.catalog.collections[0]);
  const g17 = readSignSlice(s.files, coll.signs['egyptian/G17']);
  assert.deepEqual(g17.stages, ['hieroglyph', 'hieratic', 'demotic']);
  assert.equal(g17.audio, null);
});
